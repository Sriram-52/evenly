const { AndroidConfig } = require("@expo/config-plugins");

// expo-contacts unconditionally adds WRITE_CONTACTS, but Evenly only reads
// contacts (to add roommates). Block it with tools:node="remove" so the
// released app never requests write access to the user's contacts.
module.exports = function withBlockedPermissions(config) {
  return AndroidConfig.Permissions.withBlockedPermissions(config, [
    "android.permission.WRITE_CONTACTS",
  ]);
};
