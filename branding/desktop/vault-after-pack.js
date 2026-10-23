/* Local macOS candidate only. Retain upstream fuses without copying extensions or signing proxies. */
const path = require("path");
const { Arch } = require("electron-builder");
const { flipFuses } = require("@electron/fuses");
const { electronFuses } = require("./electron-fuses");

exports.default = async function (context) {
  if (context.electronPlatformName !== "darwin" || context.arch !== Arch.arm64) {
    throw new Error("Vault candidate packaging supports macOS arm64 only");
  }
  const appPath = path.join(context.appOutDir, "Vault.app");
  await flipFuses(appPath, {
    ...electronFuses("darwin"),
    resetAdHocDarwinSignature: true,
  });
};
