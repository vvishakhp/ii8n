export type FilterFunction = (fileName: string) => boolean;

export interface IPluginOptions {
    /**
     * Filter function. If returns true, the file is treated as language file.
     */
    filter?: (fileName: string) => boolean;

    /**
     * Default language code. If no translation is provided for a specific langauge, this langaue will be used.
     */
    defaultLanguage?: string;

    /**
     * Ignore invalid language file. If false, invalid language files will break compilation.
     */
    ignoreOnError?: boolean;

    /**
     * Generate typings file for typescript intellisence.
     */
    typingsFile?: (content: string) => void;
}

