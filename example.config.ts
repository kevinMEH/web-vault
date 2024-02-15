// ATTENTION: Rename this file to config.ts for it to actually take effect.

const ENV: ENV = {

    // Set to true if using Web Vault as an application. If you do not know what
    // this means or what this does, set it to true. DO NOT play around with this
    // setting.
    PRODUCTION: true


    // Set to true if using Redis. Set to false or undefined if using in memory
    // database.
    // Ex: true, false
    ,REDIS: undefined



    // VFS Backup Interval in seconds. By default, every 30 minutes.
    // Ex: 10 * 60
    ,VFS_BACKUP_INTERVAL: undefined



    // -------------------------------------------------
    // Settings below only valid if using in memory database. (Not using Redis)
    // -------------------------------------------------

    // How long between in-memory database saves to file in seconds. Default is once
    // every day, although you might want to decrease this if you anticipate heavy
    // activity. (You should probably use Redis if you anticipate heavy activity).
    //
    // This is only relevant if you are using an in memory database, if you are using
    // Redis you can control this by editing your Redis configurations.
    // Ex: 3 * 60 * 60
    ,DATABASE_SAVE_INTERVAL: undefined

    // How long between token purges for in memory database, in seconds.
    // Leave blank for default, which is every day.
    // Ex: 3 * 60 * 60
    ,PURGE_INTERVAL: undefined

    // Where to store the VFS.
    // By default, in ./database
    // The following file names will be used: vfs.json, vfs.temp.json, vfs.old.json
    // Ex: "./database"
    ,VFS_STORE_DIRECTORY: undefined

    // -------------------------------------------------
    // -------------------------------------------------



    // The domain your Web Vault instance will be hosted on.
    // (This option is only used for the JWT and is not particularly important.)
    // Ex: "liao.gg"
    ,DOMAIN: undefined

    // Default vault access expiration from login in seconds. Default is 1 week.
    // Ex: 24 * 60 * 60
    ,JWT_EXPIRATION: undefined

    // Default admin access expiration from login in seconds. Default is 3 hours.
    // Ex: 60 * 60
    ,ADMIN_JWT_EXPIRATION: undefined

    // Allow refreshing of vault access expiration upon activity. Set to true to
    // turn on. Set to false or undefined to turn off.
    // Turn off to make users relogin to vaults once every JWT_EXPIRATION.
    // Ex: true, false
    ,ALLOW_REFRESH: undefined

    // JSON Web Token secret, should be a hex string representing 256 bits to 512 bits,
    // or 64 to 128 hexes long.
    // WARNING: Changing after setting will invalidate all previously generated tokens.
    // Ex: "79FC6E5E92ABFE048DFAB899A689584A17F9A7F35163269E64DF3E00C765B470"
    ,JWT_SECRET: undefined

    // Password Salt added to the vault password, should be a hex string representing
    // 128 or more bits (32 or more hexes long).
    // WARNING: Changing after setting will invalidate all previously set vault
    // passwords. You will have to reset all passwords.
    // Ex: "4A6046F2C281691B29B24AAF022D8D88"
    ,PASSWORD_SALT: undefined

    // Iteration count for the PBKDF2 function used to hash plaintext passwords.
    // Default is 1000. Setting a higher value will make authentication take a
    // while longer and slow down your server, but if your password hashes somehow
    // gets leaked, it will protect you against brute force attacks better.
    //
    // The default value of 1000 is very, very low. Consider setting it higher if you
    // have concerns about password hash leaks. (High example: 12345)
    // That being said, if your hashes gets leaked you likely have much bigger problems.
    //
    // WARNING: Changing after setting will invalidate all previously set vault
    // passwords. You will have to reset all passwords.
    // Ex: 12345
    ,ITERATION_COUNT: undefined



    // Default admin account name which will be created to enable you to setup vaults
    // and other settings through the admin panel.
    // Ex: "a_hard_to_guess_name"
    ,DEFAULT_ADMIN_NAME: undefined

    // The password hash for the default admin account.
    // ATTENTION: YOU MUST SUPPLY THE HASH OF THE PASSWORD, NOT THE PASSWORD.
    // To get the hash of a desired password, run the file at setup/hashPassword.ts
    // Everytime you login to the default account, use the password you chose, not the hash.
    // Ex: "3f9a8ae8273fb2ae46c22e6ee564b308f14780f2ef3c05749466c49370c2d482"
    // ^^^ Hash of #strong123password using default env.ts values ^^^
    ,DEFAULT_ADMIN_PASSWORD_HASH: undefined



    // Where to store vaults. By default, in the ./vaults folder.
    // Ex: "./vaults"
    ,BASE_VAULT_DIRECTORY: undefined

    // Where to store logs. By default, logs are stored in ./logs folder.
    // Ex: "./logs"
    ,LOGGING_DIRECTORY: undefined



    // Maximum depth of VFS allowed to be sent to the client. By default, 5
    // Ex: 2, 3, 4, 99
    ,MAX_VFS_DEPTH: undefined

}

type ENV = {
    PRODUCTION: boolean,

    REDIS?: boolean,

    VFS_BACKUP_INTERVAL?: number,

    DATABASE_SAVE_INTERVAL?: number,
    PURGE_INTERVAL?: number,
    VFS_STORE_DIRECTORY?: string,

    DOMAIN?: string,
    JWT_EXPIRATION?: number,
    ADMIN_JWT_EXPIRATION?: number,
    ALLOW_REFRESH?: boolean,
    JWT_SECRET?: string,
    PASSWORD_SALT?: string,
    ITERATION_COUNT?: number,

    DEFAULT_ADMIN_NAME?: string,
    DEFAULT_ADMIN_PASSWORD_HASH?: string,

    BASE_VAULT_DIRECTORY?: string,
    LOGGING_DIRECTORY?: string,
    
    MAX_VFS_DEPTH?: number,
}

export default ENV;