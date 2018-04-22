const {execSync} = require('child_process');

onmessage = function(e) {
  console.log("Exec_Worker: " + e.data);
  var output = execSync(e.data).toString();
  postMessage(output);
}
