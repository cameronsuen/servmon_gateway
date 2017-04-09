let socket = require('socket.io-client')('http://localhost:8000')

socket.on('connect', function() {
    console.log('Connected');
});

socket.on('updates', function(data) {

    // Get raw memory data
    let memFree = data.ram.MemFree.replace(/\s+/g, '').slice(0, -2);
    let memTotal = data.ram.MemTotal.replace(/\s+/g, '').slice(0, -2);
    let swapFree = data.ram.SwapFree.replace(/\s+/g, '').slice(0, -2);
    let swapTotal = data.ram.SwapTotal.replace(/\s+/g, '').slice(0, -2);
    let buffers_raw = data.ram.Buffers.replace(/\s+/g, '').slice(0, -2);
    
    // Proces memory data
    let totalMemory = (memFree / 1024 / 1024).toFixed(2) + "GB/" + (memTotal / 1024 / 1024).toFixed(2) + "GB";
    let buffers = (buffers_raw / 1024).toFixed(2) + "MB";
    let swapUsage = (swapFree / 1024 / 1024).toFixed(2) + "GB/" + (swapFree / 1024 / 1024).toFixed(2) + "GB";

    // Process hard disk data, removing the header row and empty row
    let harddisk_raw = data.harddisk.slice(1)
        .filter((datum) => (
            datum.length > 0
        )).map((datum) => (
            // Remove extra spaces and then split by space
            datum.replace(/\s+/g, ' ').split(' ')
        ));

    // Get percentage usage
    let storage = harddisk_raw[harddisk_raw.length - 1][4];

    // Removing the last row
    let partitions = harddisk_raw.slice(0, -1)
        .map((datum) => ({
            name: 'Partition',
            filesystem: datum[0],
            mountPt: datum[5],
            storage: datum[2] + '/' + datum[1]
        }));
    
    console.log(data.uptime);


});
