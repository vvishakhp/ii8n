export type FilterFunction = (fileName: string) => boolean;

export interface IPluginOptions {
    filter: FilterFunction | RegExp;
    defaultLanguage: string;
}