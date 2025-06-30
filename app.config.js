import 'dotenv/config'; // This line reads your .env file at the top

export default {
    // This is your entire app.json content, now as a JavaScript object
    expo: {
        name: "swe",
        slug: "swe",
        version: "1.0.0",
        orientation: "portrait",
        icon: "./assets/images/icon.png",
        scheme: "myapp",
        userInterfaceStyle: "automatic",
        newArchEnabled: true,
        ios: {
            supportsTablet: true
        },
        android: {
            adaptiveIcon: {
                foregroundImage: "./assets/images/adaptive-icon.png",
                backgroundColor: "#ffffff"
            }
        },
        web: {
            bundler: "metro",
            output: "static",
            favicon: "./assets/images/favicon.png"
        },
        plugins: [
            "expo-router",
            [
                "expo-splash-screen",
                {
                    image: "./assets/images/splash-icon.png",
                    imageWidth: 200,
                    resizeMode: "contain",
                    backgroundColor: "#ffffff"
                }
            ]
        ],
        experiments: {
            typedRoutes: true
        },

        // --- This is the new, dynamic part ---
        // The "extra" key is where we expose our .env variables to the app.
        extra: {
            API_URL: process.env.API_URL,
            AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
            AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
            CLOUDINARY_URL: process.env.CLOUDINARY_URL,
            CLOUDINARY_UPLOAD_PRESET: process.env.CLOUDINARY_UPLOAD_PRESET,
            // You must add your EAS Project ID here if you use EAS Build
            eas: {
                "projectId": "your-eas-project-id" // Find this on your expo.dev account
            }
        },
    }
};