import { toPng, toJpeg } from 'html-to-image';

export async function exportToImage(
  elementId: string, 
  filename: string, 
  type: 'png' | 'jpeg' = 'png'
) {
  const node = document.getElementById(elementId);
  if (!node) throw new Error('Render node not found');

  try {
    const dataUrl = type === 'png' 
      ? await toPng(node, { pixelRatio: 1, quality: 1.0 })
      : await toJpeg(node, { pixelRatio: 1, quality: 0.95 });
      
    // Trigger download
    const link = document.createElement('a');
    link.download = `${filename}.${type}`;
    link.href = dataUrl;
    link.click();

    // Create and return Blob for server upload
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return blob;
  } catch (err) {
    console.error('Export failed:', err);
    throw err;
  }
}
export async function exportToBlob(
  element: HTMLElement, 
  config: any
): Promise<Blob> {
  try {
    const dataUrl = await toPng(element, { 
      pixelRatio: config.scale || 1,
      style: {
        transform: 'scale(1)',
        transformOrigin: 'top left',
        width: `${config.width}px`,
        height: `${config.height}px`
      }
    });
    
    const res = await fetch(dataUrl);
    return await res.blob();
  } catch (err) {
    console.error('Export to blob failed:', err);
    throw err;
  }
}
