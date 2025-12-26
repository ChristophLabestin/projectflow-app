import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as cors from 'cors';

// Initialize admin if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}

const corsHandler = cors({ origin: true });

// Vertex AI configuration
const VERTEX_PROJECT = 'project-manager-9d0ad';
const VERTEX_LOCATION = 'europe-west3';

interface EditImageRequest {
    prompt: string;
    imageBase64: string;
    mimeType?: string;
    editMode?: 'default' | 'style';
    numberOfImages?: number;
}

/**
 * Cloud Function to edit images using Vertex AI Imagen
 * This runs server-side where we can safely use service account credentials
 */
export const editImageWithVertexAI = functions
    .region('europe-west3')
    .runWith({
        timeoutSeconds: 120,
        memory: '1GB',
    })
    .https.onRequest((req, res) => {
        corsHandler(req, res, async () => {
            // Only allow POST
            if (req.method !== 'POST') {
                res.status(405).json({ error: 'Method not allowed' });
                return;
            }

            // Verify authentication
            const authHeader = req.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const idToken = authHeader.split('Bearer ')[1];
            try {
                await admin.auth().verifyIdToken(idToken);
            } catch (error) {
                res.status(401).json({ error: 'Invalid token' });
                return;
            }

            // Parse request body
            const { prompt, imageBase64, mimeType = 'image/jpeg', numberOfImages = 4 } = req.body as EditImageRequest;

            if (!prompt || !imageBase64) {
                res.status(400).json({ error: 'Missing prompt or imageBase64' });
                return;
            }

            try {
                // Import Vertex AI SDK dynamically
                const { VertexAI } = await import('@google-cloud/vertexai');

                // Initialize Vertex AI client
                const vertexAI = new VertexAI({
                    project: VERTEX_PROJECT,
                    location: VERTEX_LOCATION,
                });

                // Get the generative model for vision
                const model = vertexAI.getGenerativeModel({
                    model: 'gemini-2.5-flash',
                });

                // Step 1: Analyze the image to get a description
                const visionResult = await model.generateContent({
                    contents: [{
                        role: 'user',
                        parts: [
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: imageBase64,
                                },
                            },
                            {
                                text: `Describe this image in detail for image generation purposes. Focus on:
- Main subject and composition
- Colors, lighting, and mood
- Style and artistic elements
- Key visual details

Provide a concise but comprehensive description (2-3 sentences) that could be used to recreate a similar image.`,
                            },
                        ],
                    }],
                });

                const imageDescription = visionResult.response?.candidates?.[0]?.content?.parts?.[0]?.text || 'A detailed image';

                // Step 2: Use the Imagen API for image generation
                // Note: For actual editImage, we need to use the Imagen API directly
                // For now, we'll use the enhanced prompt approach with Imagen

                const { GoogleAuth } = await import('google-auth-library');
                const auth = new GoogleAuth({
                    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
                });
                const client = await auth.getClient();
                const accessToken = await client.getAccessToken();

                // Create enhanced prompt
                // Prioritize user prompt over image description for all edit modes
                const enhancedPrompt = `Create an image based on this context: ${imageDescription}. 
IMPORTANT: The user wants to: ${prompt}. 
Ensure the final image strongly reflects the user's request while maintaining the core subject matter from the context if appropriate.`;

                // Call Imagen API directly for image generation
                const imagenResponse = await fetch(
                    `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/imagen-3.0-generate-001:predict`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken.token}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            instances: [{ prompt: enhancedPrompt }],
                            parameters: {
                                sampleCount: numberOfImages || 1, // Default to 1 if not specified, use passed value otherwise
                            },
                        }),
                    }
                );

                if (!imagenResponse.ok) {
                    const errorText = await imagenResponse.text();
                    console.error('Imagen API error:', errorText);
                    throw new Error(`Imagen API error: ${imagenResponse.status}`);
                }

                const imagenData = await imagenResponse.json();

                // Extract generated images
                const images: string[] = [];
                if (imagenData.predictions) {
                    for (const prediction of imagenData.predictions) {
                        if (prediction.bytesBase64Encoded) {
                            images.push(`data:image/png;base64,${prediction.bytesBase64Encoded}`);
                        }
                    }
                }

                if (images.length === 0) {
                    throw new Error('No images generated');
                }

                res.status(200).json({
                    success: true,
                    images,
                    description: imageDescription
                });

            } catch (error: any) {
                console.error('Vertex AI error:', error);
                res.status(500).json({
                    error: error.message || 'Failed to generate images',
                    details: error.toString()
                });
            }
        });
    });
