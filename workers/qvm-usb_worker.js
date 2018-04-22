const {exec, execSync} = require('child_process');

onmessage = function(e) {
  var cmd = 'qvm-device usb ls';
  var dev = e.data.dev;

  function getAttr(cmd) {
    //console.log(dev + " - Worker Command: " + cmd);
    try {
      if        ( dev == 0 ) {
        var output = execSync(cmd);
      } else if ( dev == 1 ) {
        var cmdDataCache = '/home/user/.config/QubesDashboard/datacache/'
        var cmdname = cmd.replace(/\W/g,'-').replace(/(.)(?=\1)/g, "").substring(0,43);
        exec("echo '"+cmd+"' > "+cmdDataCache+cmdname+"-input.dev");
        output = execSync('cat '+cmdDataCache+cmdname+'-output.dev');
      }
      postMessage(output.toString().trim());
    } catch (err) {
      err.stderr; err.pid; err.signal; err.status; //console.error(err);
    }
  }

  getAttr(cmd);
}
