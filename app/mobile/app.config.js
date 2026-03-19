export default {
  "expo": {
    "name": "PengAgent",
    "owner": "noahpengding",
    "slug": "peng-agent",
    "version": "2.4.2",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "plugins": [
      "expo-document-picker",
      "expo-file-system",
      "expo-image-picker",
      "expo-camera",
      "expo-secure-store"
    ],
    "ios": {
      "supportsTablet": true,
      "infoPlist": {
        "NSCameraUsageDescription": "This app uses the camera to take photos and upload them to the chat.",
        "NSPhotoLibraryUsageDescription": "This app accesses your photos to upload them to the chat."
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.noahpengding.pengagent",
      "permissions": [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "extra": {
      "eas": {
        "projectId": "cde16b50-d44d-4e28-bad6-3ddac46544f7"
      },
      "apiUrl": process.env.API_URL
    }
  }
};
