
interface IImageInfo {
    filename: string;
    base64: string; // or blob maybe? storage can only store serializable. Base64 is safe.
}

interface ISaveData {
    title: string;
    content: string;
    images: IImageInfo[];
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
    showStatus(`Ready to save "${data.title}" (${data.images.length} images).`, 'normal');

    btn.onclick = async () => {
        try {
            btn.disabled = true;
            showStatus('Selecting folder...', 'normal');

            // @ts-ignore - showDirectoryPicker is not in standard types yet or needs dom lib update
            const dirHandle = await window.showDirectoryPicker();

            showStatus('Writing files...', 'normal');

            // Write Org file
            const safeTitle = data.title.replace(/[<>:"/\\|?*]/g, '_').trim();
            const fileHandle = await dirHandle.getFileHandle(`${safeTitle}.org`, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(data.content);
            await writable.close();

            // Write Images
            if (data.images.length > 0) {
                const imgDirHandle = await dirHandle.getDirectoryHandle('images', { create: true });

                for (const img of data.images) {
                    try {
                        const imgFileHandle = await imgDirHandle.getFileHandle(img.filename, { create: true });
                        const imgWritable = await imgFileHandle.createWritable();

                        // Convert base64 to Blob
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
