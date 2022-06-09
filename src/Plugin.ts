import {IPluginOptions} from "./types/IPluginOptions";
import { Compilation, sources, Compiler } from "webpack";
import * as path from "path";
import * as fs from "fs";
import {ILangFile} from "./types/ILangFile";
import {IResultFile} from "./types/IResultFile";

const PLUGIN_NAME = "LanguagePlugin";

export class Plugin {
    fileList: string[] = [];

    private filter: (fileName: string) => boolean;
    private defaultLanguage: string;
    private ignoreError: boolean;
    private typingsFile: (content: string) => void;

    constructor(private options?: IPluginOptions) {
        this.filter = options?.filter || ((f) => f.endsWith(".lang.json"));
        this.defaultLanguage = options?.defaultLanguage || "en-US";
        this.ignoreError = options?.ignoreOnError ?? true;
        this.typingsFile = options?.typingsFile || (() => null);
    }

    public apply(compiler: Compiler) {
        const logger = compiler.getInfrastructureLogger(PLUGIN_NAME);

        compiler.hooks.beforeCompile.tap(PLUGIN_NAME, () => {
            this.fileList = [];
            logger.debug("Language File list has bees reset.");
        });

        compiler.hooks.beforeCompile.tap(PLUGIN_NAME, (params) => {
            params.normalModuleFactory.hooks.beforeResolve.tap(
                PLUGIN_NAME,
                (resolveData) => {
                    const filePath = path.join(resolveData.context, resolveData.request);
                    if (!fs.existsSync(filePath)) return undefined;
                    if (this.filter(filePath)) {
                        // Process language file diffrently
                        this.fileList.push(filePath);
                        logger.debug(`File added to language file processig : ${filePath}`);
                        return false;
                    }
                }
            );
        });

        compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
            compilation.hooks.processAssets.tapAsync(
                {
                    name: PLUGIN_NAME,
                    stage: Compilation.PROCESS_ASSETS_STAGE_PRE_PROCESS,
                },
                async (assetList, callback) => {
                    const startTime = performance.now();

                    const fileContents = await Promise.all(
                        this.fileList.map(this.getFileContent)
                    );

                    const jsonContent = fileContents.map((s, i) =>
                        this.toJson(s, this.fileList[i])
                    );

                    const assets = this.buildLanguageFiles(jsonContent);
                    assets.forEach((asset) => {
                        compilation.emitAsset(
                            `./lang/${asset.name}.json`,
                            new sources.RawSource(asset.content)
                        );
                    });
                    logger.info(
                        `Procesed ${this.fileList.length} langugae files in ${(
                            performance.now() - startTime
                        ).toFixed(2)} ms.`
                    );
                    callback();
                }
            );
        });
    }

    async getFileContent(fileName: string) {
        return (await fs.promises.readFile(fileName)).toString("utf-8");
    }

    buildLanguageFiles(
        langFiles: ILangFile[]
    ): { name: string; content: string }[] {
        const defaultValues = {};
        const langKeys = new Set<string>();
        const strKeys = new Set<string>();

        const languages: { [key: string]: IResultFile } = {};
        for (const langFile of langFiles) {
            for (const strKey of Object.keys(langFile)) {
                for (const langKey of Object.keys(langFile[strKey])) {
                    langKeys.add(langKey);
                    strKeys.add(strKey);

                    if (langKey == this.defaultLanguage)
                        defaultValues[strKey] = langFile[strKey][langKey];
                    if (!languages[langKey]) languages[langKey] = {};
                    if (languages[langKey][strKey])
                        throw new Error(`Duplicate key ${strKey} found`);
                    languages[langKey][strKey] = langFile[strKey][langKey];
                }
            }
        }

        Object.keys(languages).forEach((langKey) => {
            Object.keys(defaultValues).forEach((strKey) => {
                if (!languages[langKey][strKey]) {
                    languages[langKey][strKey] = defaultValues[strKey] as string;
                }
            });
        });

        const langKeysType =
            langKeys.size > 0
                ? `declare type LanguageKeys = ${Array.from(langKeys)
                    .map((l) => JSON.stringify(l))
                    .join("\n\t| ")};`
                : "";
        const strKeysType =
            strKeys.size > 0
                ? `declare type StringKeys = ${Array.from(strKeys)
                    .map((l) => JSON.stringify(l))
                    .join("\n\t| ")};`
                : "";

        this.typingsFile(`${langKeysType}\n\n${strKeysType}`);

        return Object.keys(languages).map((l) => ({
            name: l,
            content: JSON.stringify(languages[l]),
        }));
    }

    private toJson(str: string, file = "") {
        try {
            return JSON.parse(str);
        } catch (e: any) {
            if (!this.ignoreError)
                throw new Error(
                    `Invalid Langauge file found:${file}\n${e.message ?? e}`
                );
        }

        return {};
    }
}
