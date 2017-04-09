let mongoClient = require('mongodb').MongoClient;
let assert = require('assert');

let url = 'mongodb://localhost/test_database';
let db = null;

// Store the no. of ticks in previous update
let prev_totalTime = 0;
let prev_workTime = 0;
let prev_p_totalTime = 0;

mongoClient.connect(url, function(err, _db) {
    assert.equal(null, err);
    console.log('Successfully Connected');
    db = _db;
});

let socket = require('socket.io-client')('http://localhost:8000');

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
    let totalMemory = ((memTotal - memFree) / 1024 / 1024).toFixed(2) + "GB/" + (memTotal / 1024 / 1024).toFixed(2) + "GB";
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
    
    let cpu_stat = data.cpu.cpu.split(' ')

    // Building the cores info array
    let core_stat = Object.keys(data.cpu).filter((val) => (
        val.match(/cpu[0-9]+/) !== null
    )).map((val, index) => {
        let cpu = data.cpu[val].trim().replace(/\s+/g, ' ').split(' ');
        return {
            name: val,
            frequency: data.cpuinfo[index] + 'MHz',
            usage: (Number(cpu[0]) + Number(cpu[1]) + Number(cpu[2])) / cpu.reduce((acc, val) => (acc + Number(val)), 0) * 100 + '%'
        }
    });
    
    // Get total no. of cpu ticks 
    let totalTime = cpu_stat.reduce((acc, val) => (acc + Number(val)), 0);
    // Get no. of cpu ticks spent working
    let workTime = Number(cpu_stat[0]) + Number(cpu_stat[1]) + Number(cpu_stat[2]);

    let cpu_usage = (workTime - prev_workTime) / (totalTime - prev_totalTime) * 100 + '%';

    let p_stat = data.process[0].split(' ');
    
    // Process id 
    let p_pid = p_stat[0];
    // Process name
    let p_name = p_stat[1].substring(1, p_stat[1].length - 1);
    // CPU Time spent in user mode
    let p_utime = p_stat[13];
    // CPU Time spent in kernel mode
    let p_stime = p_stat[14];
    // Waited-for-Children time spent in user mode
    let p_cutime = p_stat[15];
    // Waited-for-Children time spent in kernel mode
    let p_cstime = p_stat[16];
    // Time when process started
    let p_starttime = p_stat[21];

    // Unit in No. of ticks 
    let p_totalTime = Number(p_utime) + Number(p_stime);

    let p_usage = (p_totalTime - prev_p_totalTime) / (totalTime - prev_totalTime) * 100;

    console.log(data.process);
    let p_uid = data.process[1];
    let p_gid = data.process[2];
    let p_ram = data.process[3] / 1024 + "MB/" + (data.process[3] / memTotal * 100).toFixed(2) + '%' ;

    prev_workTime = workTime;
    prev_totalTime = totalTime;
    prev_p_totalTime = p_totalTime;

    data = {
        cpu: cpu_usage,
        cpuData: {
            cores: core_stat
        },
        storage: storage,
        storageData: {
            storagePartitions: partitions
        },
        ram: ((memTotal - memFree) / memTotal * 100).toFixed(2) + '%',
        ramData: {
            totalMemory: totalMemory,
            buffers: buffers,
            swapUsage: swapUsage
        },
        process: true,
        processData: {
            processes: [
                {
                    name: p_name,
                    pid: p_pid,
                    uid: p_uid,
                    gid: p_gid,
                    cpuOccupied: p_usage,
                    ramOccupied: p_ram
                }
            ]
        }
    }

    console.log(data);

    if (db !== null) {
        db.collection('machine_states').insert({
            hostname: 'localhost',
            status: true,
            data: data
        }, function(err, result) {
            console.log(result);
        });
    }

});
