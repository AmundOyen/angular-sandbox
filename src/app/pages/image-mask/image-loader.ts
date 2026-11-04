import { Injectable } from '@angular/core';

export interface LoadedImage {
  /** Object URL for the file; must be released when no longer shown. */
  url: string;
  name: string;
  width: number;
  height: number;
}

@Injectable({ providedIn: 'root' })
export class ImageLoader {
  load(file: File): Promise<LoadedImage> {
    const url = URL.createObjectURL(file);
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () =>
        resolve({ url, name: file.name, width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Could not decode ${file.name}`));
      };
      image.src = url;
    });
  }

  release(image: LoadedImage): void {
    URL.revokeObjectURL(image.url);
  }
}
