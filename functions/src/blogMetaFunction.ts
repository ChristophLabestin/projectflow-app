/**
 * Blog Meta Tags Cloud Function
 * 
 * Add this to your existing Firebase Functions codebase.
 * This function serves dynamic OG meta tags for blog posts.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Copy this file to your functions/src/ directory (e.g., as blogMeta.ts)
 * 2. Export the function from your main index.ts (see instructions below)
 * 3. Ensure you have the blog_posts collection in Firestore
 * 4. Update your firebase.json hosting rewrites (see instructions below)
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

// Note: Don't call admin.initializeApp() here if it's already called in your main index.ts
// If this is a separate file, you may need to get the db reference differently

/**
 * Creates the blog meta function.
 * @param db - Firestore database instance (pass from your main index.ts)
 * @param indexHtmlPath - Path to the index.html file for the landing page
 */
export function createBlogMetaFunction(db: admin.firestore.Firestore, indexHtmlPath: string) {
    return functions.region('europe-west3').https.onRequest(async (req, res) => {
        // We inject meta tags for all requests (both users and crawlers)
        // This ensures consistency and avoids user-agent detection complexity

        // URL format: /blog/slug-or-id
        // req.path will be /blog/slug
        const [, , slug] = req.path.split("/");

        // Read index.html
        let html: string;
        try {
            html = fs.readFileSync(indexHtmlPath, "utf8");
        } catch (error) {
            console.error("Error reading index.html:", error);
            res.status(500).send("Internal Server Error");
            return;
        }

        if (!slug) {
            res.send(html);
            return;
        }

        try {
            // Try to find by slug first
            let postData: FirebaseFirestore.DocumentData | undefined;
            const postsRef = db.collection("blog_posts");

            const qSnapshot = await postsRef.where("slug", "==", slug).limit(1).get();

            if (!qSnapshot.empty) {
                postData = qSnapshot.docs[0].data();
            } else {
                // Try ID
                const docSnapshot = await postsRef.doc(slug).get();
                if (docSnapshot.exists) {
                    postData = docSnapshot.data();
                }
            }

            if (postData) {
                const title = postData.title || "Project Flow";
                const description = postData.excerpt || "Project Flow Blog";
                const image = postData.coverImage || "/og-image.png";

                // Replace meta tags
                html = html.replace(/<meta property="og:title" content="[^"]+"[^>]*>/g, `<meta property="og:title" content="${escapeHtml(title)} | Project Flow" />`);
                html = html.replace(/<meta property="og:description" content="[^"]+"[^>]*>/g, `<meta property="og:description" content="${escapeHtml(description)}" />`);
                html = html.replace(/<meta property="og:image" content="[^"]+"[^>]*>/g, `<meta property="og:image" content="${image}" />`);
                html = html.replace(/<meta name="twitter:title" content="[^"]+"[^>]*>/g, `<meta name="twitter:title" content="${escapeHtml(title)} | Project Flow" />`);
                html = html.replace(/<meta name="twitter:description" content="[^"]+"[^>]*>/g, `<meta name="twitter:description" content="${escapeHtml(description)}" />`);
                html = html.replace(/<meta name="twitter:image" content="[^"]+"[^>]*>/g, `<meta name="twitter:image" content="${image}" />`);

                // Also update <title>
                html = html.replace(/<title>.*<\/title>/, `<title>${escapeHtml(title)} | Project Flow</title>`);
            }
        } catch (error) {
            console.error("Error fetching blog post:", error);
            // On error, just serve the default HTML
        }

        res.set("Cache-Control", "public, max-age=300, s-maxage=600");
        res.send(html);
    });
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ============================================================
// ALTERNATIVE: Standalone version if you prefer a simpler setup
// ============================================================

/**
 * Standalone version - use this if you want a self-contained function.
 * Make sure admin.initializeApp() is called before this runs.
 */
export const blogMetaHandler = functions.https.onRequest(async (req, res) => {
    const db = admin.firestore();

    const [, , slug] = req.path.split("/");

    // You need to copy the landing page's index.html to your functions directory
    // during deployment. Update this path accordingly.
    const indexHtmlPath = path.join(__dirname, "../landing-page-index.html");

    let html: string;
    try {
        html = fs.readFileSync(indexHtmlPath, "utf8");
    } catch (error) {
        console.error("Error reading index.html:", error);
        res.status(500).send("Internal Server Error");
        return;
    }

    if (!slug) {
        res.send(html);
        return;
    }

    try {
        let postData: FirebaseFirestore.DocumentData | undefined;
        const postsRef = db.collection("blog_posts");

        const qSnapshot = await postsRef.where("slug", "==", slug).limit(1).get();

        if (!qSnapshot.empty) {
            postData = qSnapshot.docs[0].data();
        } else {
            const docSnapshot = await postsRef.doc(slug).get();
            if (docSnapshot.exists) {
                postData = docSnapshot.data();
            }
        }

        if (postData) {
            const title = postData.title || "Project Flow";
            const description = postData.excerpt || "Project Flow Blog";
            const image = postData.coverImage || "/og-image.png";

            html = html.replace(/<meta property="og:title" content="[^"]+"[^>]*>/g, `<meta property="og:title" content="${escapeHtml(title)} | Project Flow" />`);
            html = html.replace(/<meta property="og:description" content="[^"]+"[^>]*>/g, `<meta property="og:description" content="${escapeHtml(description)}" />`);
            html = html.replace(/<meta property="og:image" content="[^"]+"[^>]*>/g, `<meta property="og:image" content="${image}" />`);
            html = html.replace(/<meta name="twitter:title" content="[^"]+"[^>]*>/g, `<meta name="twitter:title" content="${escapeHtml(title)} | Project Flow" />`);
            html = html.replace(/<meta name="twitter:description" content="[^"]+"[^>]*>/g, `<meta name="twitter:description" content="${escapeHtml(description)}" />`);
            html = html.replace(/<meta name="twitter:image" content="[^"]+"[^>]*>/g, `<meta name="twitter:image" content="${image}" />`);
            html = html.replace(/<title>.*<\/title>/, `<title>${escapeHtml(title)} | Project Flow</title>`);
        }
    } catch (error) {
        console.error("Error fetching blog post:", error);
    }

    res.set("Cache-Control", "public, max-age=300, s-maxage=600");
    res.send(html);
});
