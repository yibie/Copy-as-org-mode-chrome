import Defuddle from 'defuddle';
import { applySiteExtraction, extractSite } from './extractors';

declare global {
    interface Window {
        Defuddle: typeof Defuddle;
    }
}

type DefuddleOptions = ConstructorParameters<typeof Defuddle>[1];

/** Defuddle plus our site extractors (src/extractors) */
class DefuddleWithSites extends Defuddle {
    private siteDoc: Document;
    private siteUrl: string;

    constructor(doc: Document, options?: DefuddleOptions) {
        super(doc, options);
        this.siteDoc = doc;
        this.siteUrl = options?.url || doc.URL;
    }

    parse() {
        return applySiteExtraction(super.parse(), extractSite(this.siteDoc, this.siteUrl));
    }

    async parseAsync() {
        return applySiteExtraction(await super.parseAsync(), extractSite(this.siteDoc, this.siteUrl));
    }
}

if (typeof window !== 'undefined') {
    (window as any).Defuddle = DefuddleWithSites;
}
