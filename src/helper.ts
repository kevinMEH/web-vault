function unixTime() {
    return Math.floor(Date.now() / 1000);
}

export { unixTime };