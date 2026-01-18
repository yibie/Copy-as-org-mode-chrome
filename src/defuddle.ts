import Defuddle from 'defuddle';

declare global {
    interface Window {
        Defuddle: typeof Defuddle;
    }
}

if (typeof window !== 'undefined') {
    (window as any).Defuddle = Defuddle;
}
