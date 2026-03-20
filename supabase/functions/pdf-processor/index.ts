import { createClient } from '@supabase/supabase-js'
import { serve } from "@std/http/server";
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// Set up PDF.js worker source from the imported package
// This URL should resolve to the worker script provided by pdfjs-dist via esm.sh
GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

async function convertPdfToImages(pdfBuffer: ArrayBuffer): Promise<ArrayBuffer[]> {
  console.log('Converting PDF to images...');
  const images: ArrayBuffer[] = [];
  const loadingTask = getDocument({ data: pdfBuffer });
  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDocument.getPage(i);
    // Adjust scale for rendering. Higher scale means higher resolution.
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      console.error('Could not get canvas context.');
      // Skip this page if context is not available
      continue;
    }
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    // Convert canvas to PNG ArrayBuffer
    await new Promise<void>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (reader.result instanceof ArrayBuffer) {
              images.push(reader.result);
              resolve();
            } else {
              reject(new Error('Failed to read blob as ArrayBuffer'));
            }
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(blob);
        } else {
          reject(new Error('Canvas toBlob failed'));
        }
      }, 'image/png'); // Specify the desired image format
    });
    page.cleanup(); // Clean up page resources to prevent memory leaks
  }
  pdfDocument.destroy(); // Clean up document resources
  console.log(`Successfully converted ${numPages} pages to images.`);
  return images;
}


serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }
  
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { record } = await req.json();
    const { name: filePath, bucket_id: bucketName } = record;

    if (!filePath.startsWith('decks/')) {
      return new Response(JSON.stringify({ message: 'Not a deck file, skipping.' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: fileData, error: downloadError } = await supabaseClient
      .storage
      .from(bucketName)
      .download(filePath);

    if (downloadError) throw downloadError;
    console.log(`Successfully downloaded ${filePath}`);

    const pdfBuffer = await fileData.arrayBuffer();
    // We now call the function without await as it's no longer async
    const imageBuffers = await convertPdfToImages(pdfBuffer);
    
    if (imageBuffers.length === 0) {
      console.warn("Conversion resulted in 0 images. Aborting.");
      return new Response(JSON.stringify({ message: "Conversion failed or produced no images." }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const imageUrls = [];
    const fileBaseName = filePath.split('/').pop()?.replace('.pdf', '');
    const deckId = fileBaseName;

    for (let i = 0; i < imageBuffers.length; i++) {
      const imagePath = `deck-images/${deckId}/page-${i + 1}.png`;
      
      const { error: uploadError } = await supabaseClient.storage
        .from('decks')
        .upload(imagePath, imageBuffers[i], {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabaseClient.storage.from('decks').getPublicUrl(imagePath);
      imageUrls.push(urlData.publicUrl);
    }
    console.log(`Successfully uploaded ${imageUrls.length} images.`);

    const { error: dbError } = await supabaseClient
      .from('decks')
      .update({ pages: imageUrls, status: 'PROCESSED' })
      .eq('slug', deckId);

    if (dbError) throw dbError;
    console.log(`Successfully updated deck ${deckId} in the database.`);

    return new Response(JSON.stringify({ imageUrls }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error) {
    console.error(error);
    const err = error as Error;
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});