declare module '@romanize/korean' {
  export function romanize(text: string): string;
}
declare module '@sglkc/kuroshiro-analyzer-kuromoji' {
  export default class KuromojiAnalyzer {
    constructor(opts?: { dictPath?: string });
  }
}
