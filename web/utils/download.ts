
/**
 * Triggers a browser download for a given URL.
 * Uses fetch+blob to ensure the browser downloads the file instead of just opening it,
 * and to better respect the suggested filename.
 */
export const downloadFile = async (url: string, filename: string) => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');

        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;

        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error('Download failed:', error);
        // Fallback: just open in new tab if fetch fails (e.g. CORS)
        window.open(url, '_blank');
    }
};
