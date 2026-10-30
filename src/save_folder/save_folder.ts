
import JSZip from 'jszip';
import { orgFilename } from '../org-filename';

interface IImageInfo {
    filename: string;
    base64: string; 
}

interface ISaveData {
    title: string;
    filename?: string;
    content: string;
    images: IImageInfo[];
}

// Remember the last chosen folder. FileSystemDirectoryHandle survives structured
// clone, so it can live in IndexedDB (chrome.storage cannot hold it).
const DB_NAME = 'caom-save-folder';
const DB_STORE = 'handles';
const LAST_DIR_KEY = 'lastDir';

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function loadLastDir(): Promise<any> {
    try {
        const db = await openDb();
        return await new Promise((resolve, reject) => {
            const req = db.transaction(DB_STORE).objectStore(DB_STORE).get(LAST_DIR_KEY);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn('Failed to load last folder', e);
        return undefined;
    }
}

async function saveLastDir(handle: any): Promise<void> {
    try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(DB_STORE, 'readwrite');
            tx.objectStore(DB_STORE).put(handle, LAST_DIR_KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.warn('Failed to remember folder', e);
    }
}

async function pickDirectory(): Promise<any> {
    const lastDir = await loadLastDir();
    const options = { id: 'caom-save', mode: 'readwrite' };
    if (lastDir) {
        try {
            // @ts-ignore
            return await window.showDirectoryPicker({ ...options, startIn: lastDir });
        } catch (err: any) {
            if (err.name === 'AbortError') throw err;
            // Stale handle (folder moved or deleted): retry without it.
            console.warn('Last folder unusable, picking without it', err);
        }
    }
    // @ts-ignore
    return await window.showDirectoryPicker(options);
}

const statusEl = document.getElementById('status') as HTMLElement;
const btn = document.getElementById('selectFolderBtn') as HTMLButtonElement;

async function main() {
    const urlParams = new URLSearchParams(window.location.search);
    const dataId = urlParams.get('id');

    if (!dataId) {
        showStatus('Error: No data ID provided.', 'error');
        btn.disabled = true;
        return;
    }

    // Fetch data from storage
    const result = await chrome.storage.local.get(dataId);
    const data = result[dataId] as ISaveData;

    if (!data) {
        showStatus('Error: Data not found or expired.', 'error');
        btn.disabled = true;
        return;
    }

    console.log('Data loaded', data);
    console.log('Images info:', data.images);
    
    // Optimistic UI: Always assume Folder is preferred
    btn.textContent = 'Select Folder to Save';
    showStatus(`Ready to save "${data.filename || data.title}" (${data.images.length} images).`, 'normal');

    btn.onclick = async () => {
        try {
            btn.disabled = true;

            // Determine filenames
            const filename = data.filename || orgFilename(data.title);

            let dirHandle;
            let fileSystemAccessFailed = false;

            try {
                showStatus('Selecting folder...', 'normal');
                // @ts-ignore
                if (typeof window.showDirectoryPicker !== 'function') {
                    throw new Error("API_MISSING");
                }
                dirHandle = await pickDirectory();
            } catch (err: any) {
                // If user cancelled, re-throw
                if (err.name === 'AbortError') throw err;
                
                // If API missing or other error, fallback to ZIP
                console.warn("FileSystem API failed or missing, falling back to ZIP", err);
                fileSystemAccessFailed = true;
                showStatus('Folder access failed. Switching to ZIP...', 'normal');
            }

            if (!fileSystemAccessFailed && dirHandle) {
                showStatus('Writing files...', 'normal');
                await saveLastDir(dirHandle);
                const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(data.content);
                await writable.close();

                if (data.images.length > 0) {
                    const imgDirHandle = await dirHandle.getDirectoryHandle('images', { create: true });
                    for (const img of data.images) {
                        try {
                            const imgFileHandle = await imgDirHandle.getFileHandle(img.filename, { create: true });
                            const imgWritable = await imgFileHandle.createWritable();
                            const response = await fetch(img.base64);
                            const blob = await response.blob();
                            await imgWritable.write(blob);
                            await imgWritable.close();
                        } catch (e) {
                            console.error('Failed to save image', img.filename, e);
                        }
                    }
                }
                showStatus('Saved successfully! You can close this tab.', 'success');
            } else {
                // Fallback: JSZip
                showStatus('Creating ZIP file...', 'normal');
                const zip = new JSZip();
                
                // Add org file
                zip.file(filename, data.content);

                // Add images
                if (data.images.length > 0) {
                    const imgFolder = zip.folder("images");
                    for (const img of data.images) {
                        // Extract base64 data (remove data:image/png;base64, prefix)
                        const base64Data = img.base64.split(',')[1];
                        if (imgFolder) {
                            imgFolder.file(img.filename, base64Data, {base64: true});
                        }
                    }
                }

                showStatus('Generating ZIP...', 'normal');
                const content = await zip.generateAsync({type:"blob"});
                
                // Trigger download
                const zipFilename = filename.replace(/\.org$/, '.zip');
                const url = URL.createObjectURL(content);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = zipFilename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                showStatus('Downloaded successfully! You can close this tab.', 'success');
            }

            // Cleanup storage
            chrome.storage.local.remove(dataId);

            // Auto close after 3s
            setTimeout(() => {
                window.close();
            }, 3000);

        } catch (err: any) {
            console.error(err);
            if (err.name === 'AbortError') {
                showStatus('Cancelled by user.', 'normal');
            } else {
                showStatus('Error: ' + err.message, 'error');
            }
            btn.disabled = false;
        }
    };
}

function showStatus(msg: string, type: 'error' | 'success' | 'normal') {
    statusEl.textContent = msg;
    statusEl.className = type;
}

main();
