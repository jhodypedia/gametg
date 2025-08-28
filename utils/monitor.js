// utils/monitor.js
const os = require("os");
const si = require("systeminformation"); // optional: more detailed metrics (install if wanted)

module.exports = async function monitor() {
  const memTotal = os.totalmem();
  const memFree = os.freemem();
  const uptime = os.uptime();
  const load = os.loadavg(); // 1,5,15
  const cpus = os.cpus();

  // Simple CPU usage estimate
  const cpuInfo = cpus.map((c, i) => ({
    model: c.model,
    speed: c.speed
  }));

  // if systeminformation installed, you can add more
  let diskInfo = null;
  try {
    const siModule = require("systeminformation");
    const fsSize = await siModule.fsSize();
    diskInfo = fsSize;
  } catch (e) {
    diskInfo = null;
  }

  return {
    memTotal,
    memFree,
    memUsed: memTotal - memFree,
    memUsagePercent: Math.round(((memTotal - memFree) / memTotal) * 100),
    uptime,
    load,
    cpuCount: cpus.length,
    cpuInfo,
    diskInfo
  };
};
