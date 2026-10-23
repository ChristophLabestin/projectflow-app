// electron-builder afterPack: flips Electron fuses on the packaged binary (concept §3).
const path = require('node:path');
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

exports.default = async (context) => {
    const { electronPlatformName, appOutDir, packager } = context;
    // Universal macOS builds pack x64 and arm64 into "*-temp" dirs and merge them afterwards; both halves must stay
    // byte-identical outside the binaries, so the fuses are flipped only on the merged universal app.
    if (/universal-(x64|arm64)-temp$/.test(appOutDir)) return;
    const name = packager.appInfo.productFilename;
    const binary = electronPlatformName === 'darwin'
        ? path.join(appOutDir, `${name}.app`, 'Contents', 'MacOS', name)
        : electronPlatformName === 'win32'
            ? path.join(appOutDir, `${name}.exe`)
            : path.join(appOutDir, packager.executableName);
    await flipFuses(binary, {
        version: FuseVersion.V1,
        resetAdHocDarwinSignature: electronPlatformName === 'darwin',
        [FuseV1Options.RunAsNode]: false,
        [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
        [FuseV1Options.EnableNodeCliInspectArguments]: false,
        [FuseV1Options.OnlyLoadAppFromAsar]: true,
        [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
        [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
        // Auth session cookies are encrypted with the OS keychain / DPAPI.
        [FuseV1Options.EnableCookieEncryption]: true
    });
};
