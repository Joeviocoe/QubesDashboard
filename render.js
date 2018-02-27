const {remote} = require('electron');
const {dialog} = require('electron').remote;
const {Menu, MenuItem} = remote
const prompt = require('electron-prompt');
const {exec, execSync} = require('child_process');
const fs = require('fs');
const Store = require('./store.js');

const store = new Store({
  configName: 'user-preferences'
});

/// Set file paths
var resourcePath = process.resourcesPath;
var imgPath = resourcePath + '/imgfiles/';
var userDataPath = remote.app.getPath('userData');
var cmdDataCache = userDataPath+'/datacache/';
var vms_css = userDataPath+'/vms.css';
var theme_css = userDataPath+'/theme.css';
var bgimage_file = userDataPath+'/background.jpg'

/// Define Workers
//execWorker = new Worker("exec_worker.js");
lsWorker = new Worker("qvm-ls_worker.js");
prefWorker = new Worker("qvm-pref_worker.js");
featWorker = new Worker("qvm-feat_worker.js");

/// Set environment
var host = execSync('hostname').toString().trim();
if ( !fs.existsSync(cmdDataCache) ) { execSync('mkdir '+cmdDataCache); }
if ( host == "dom0" ) { var dev = 0; } else { var dev = 1; }
console.log("============>\tQubes Dashboard running on " + host);

/// Run a command on host system

/*
function X(cmd) {
  execWorker.postMessage(cmd);
}
*/
/*
function runX(cmd,direction,destination,opt) {
  var output = "";
  if ( opt != 'quiet' ) { console.log('Running: ' + cmd) }
  var cmdname = cmd.replace(/\W/g,'-').substring(0,31);
  try {
    if        ( devenv == 0 ) {
      if        ( direction == '>>' ) {
        execWorker.postMessage(cmd);
      } else if ( direction == '<->' ) {
        output = execSync(cmd);
      }
    } else if ( devenv == 1 ) {
      if        ( direction == '>>' ) {
        if        ( destination == 'local' ) {
          execWorker.postMessage(cmd);
        } else if ( destination == 'remote' ) {
          exec('echo "'+cmd+'" > '+cmdDataCache+cmdname+'-input.dev');
          output = execSync('cat '+cmdDataCache+cmdname+'-output.dev');
        }
      } else if ( direction == '<->' ) {
        if        ( destination == 'local' ) {
          output = execSync(cmd);
        } else if ( destination == 'remote' ) {
          exec('echo "'+cmd+'" > '+cmdDataCache+cmdname+'-input.dev');
          output = execSync('cat '+cmdDataCache+cmdname+'-output.dev');
        }
      }
    }
  } catch (err) {
    err.stderr; err.pid; err.signal; err.status; //console.error(err);
  }
  return output.toString().trim();
}
*/

/// F12 to open/close Dev Tools Console, F5 to Refresh
function bindDevConsole() {
  document.addEventListener("keydown", function (e) {
    if (e.which === 123) {
      remote.getCurrentWindow().toggleDevTools();
    } else if (e.which === 116) {
      location.reload();
    }
  });
}

/// Load additional css files
function loadcssfile(filePath) {
  $("<link/>", {
     rel: "stylesheet",
     type: "text/css",
     href: filePath
  }).appendTo("head");
}

/// Create Snap Grid
var vert_int = window.innerHeight / 50;
var top = vert_int, bottom = window.innerHeight - vert_int;
var hori_int = window.innerWidth / 50;
var left = hori_int, right = window.innerWidth - hori_int;

/// Random position
function randomIntFromInterval(min,max) {
    return Math.floor(Math.random()*(max-min+1)+min);
}

///////////////////////////////////////////////////////////////////
var VMs = {};

/// Query list of VMs with Preferences/Features
function getVMs(int) {
  lsWorker.postMessage({'int':int,'dev':dev});
}
function getPrefs(int){
  prefWorker.postMessage({'int':int,'dev':dev});
}
function getFeats(int){
  featWorker.postMessage({'int':int,'dev':dev});
}

/// Receive list of VMs with Preferences/Features
lsWorker.onmessage = function(e) {
  var ls = e.data;
  var header = ls.split('\n')[0].toString().split(/\s+/g);
  var qvm_ls = ls.split('\n'); qvm_ls.shift()
  qvm_ls.forEach(function (item) {
    var item = item.split(/\s+/g);
    if ( item[0] != '' ) {
      VMs[item[0]] = new Object();
      item.forEach( function (val,index) {
        VMs[item[0]][header[index]] = val;
      });
    }
  });
  if ( $('.vm').length == 0 ) {
    drawVMs();
  } else {
    refreshVMs();
  }
}
prefWorker.onmessage = function(e) {
  var prefs = e.data.split('\n');
  prefs.forEach(function (item) {
    var item = item.split(/\s+/g);
    VMs[item[0]][item[1]] = item[3];
  });
}
featWorker.onmessage = function(e) {
  var feats = e.data.split('\n');
  feats.forEach(function (item) {
    var item = item.split(/\s+/g);
    if ( item[2] === undefined ) { item[2] = 0; }
    VMs[item[0]][item[1]] = item[2];
  });
  checkUpdates();
}

/*
function buildAttributes() {
    Object.keys(VMs).forEach(function (vm) {
      var prefs = runX('qvm-prefs ','quiet').split('\n');
      var features = runX('qvm-features ','quiet').split('\n');
      prefs.forEach(function (item) {
        var item = item.split(/\s+/g);
        VMs[vm][item[0]] = item[2];
      })
      features.forEach(function (item) {
        var item = item.split(/\s+/g);
        if ( item[1] === undefined ) { item[1] = 0; }
        VMs[vm][item[0]] = item[1];
      })
    })
  return VMs;
}

/// Get Devices
function buildDevices() {
  var usb = runX('qvm-usb','>>','remote','quiet');
  var pci = runX('qvm-pci','>>','remote','quiet');
}
*/

/// Set the board with VMs
function drawVMs() {
  var vm_positions = fs.readFileSync(vms_css, 'utf8');
  for ( vm in VMs ) {
    //console.log(VMs[vm]);
    var icon = 'cubes/' + VMs[vm]['LABEL'] + '.png';
    $('div.container').append('<div id='+vm+' class=vm>'+vm+'</div>');
    $('#'+vm).append('<img class=cubeicon src='+icon+'>');
    $('#dom0').children('img').attr('src','cubes/tesseract.gif');
    if ( vm_positions.indexOf(vm) <= 0 ) {
      $('#'+vm).css("left",randomIntFromInterval(left,right-hori_int)+'px');
      $('#'+vm).css("top",randomIntFromInterval(bottom-vert_int,top)+'px');
    }
  }
  eventListeners();
  refreshVMs();
  themeInvert();
}

/// Update VM status on board
function refreshVMs() {
  for ( vm in VMs ) {
    var state = VMs[vm]['STATE'];
    if ( state == 'Running' && $('#'+vm+':not(.activeVM').length > 0 ) {
      var gif = $('#'+vm).children('img').attr('src').replace('.png','.gif');
      $('#'+vm).removeClass('activeVM inactiveVM transientVM');
      $('#'+vm).addClass('activeVM').children('img').attr('src',gif);
    }
    if ( state == 'Halted' && $('#'+vm+':not(.inactiveVM').length > 0 ) {
      var png = $('#'+vm).children('img').attr('src').replace('.gif','.png');
      $('#'+vm).removeClass('activeVM inactiveVM transientVM');
      $('#'+vm).addClass('inactiveVM').children('img').attr('src',png);
    }
    if ( state == 'Transient' && $('#'+vm+':not(.transientVM').length > 0 ) {
      $('#'+vm).removeClass('activeVM inactiveVM transientVM');
      $('#'+vm).addClass('transientVM');
    }
  }
}

///////////////////////////////////////////////////////////////////

/// Allow VMs to be moved
var moving = 0;
function toggleMove() {
  if ( moving == 0 ) {
    $('.vm').each(function() {
      jsPlumb.setDraggable($(this),true);
      jsPlumb.draggable($(this),{ grid: [hori_int,vert_int] });
      $(this).addClass('shake');
    })
    label_move = "Lock VM icons", icon_move = imgPath+'lock2.png', moving = 1;
  } else {
    $('.vm').each(function() {
      jsPlumb.setDraggable($(this),false);
      $(this).removeClass('shake');
    });
    saveVMpositions();
    label_move = "Unlock VM icons", icon_move = imgPath+'lock1.png', moving = 0;
  }
}

/// Save VM positions to CSS file
function saveVMpositions() {
  fs.writeFileSync(vms_css,'');
  for ( vm in VMs ) {
    var elem = $('#'+vm), id = elem.attr('id');
    var left = (elem.css('left').split('px')[0] / window.innerWidth * 100).toFixed(0) + '%';
    var top  = (elem.css('top').split('px')[0] / window.innerHeight * 100).toFixed(0) + '%';
    var line = '#' + id + ' { left: '+ left + '; top: ' + top + '; }\n'
    fs.appendFile(vms_css,line,function(err) {
      if (err) console.error(err);
    });
  }
  location.reload();
}

/// Check for available updates for TemplateVMs
function checkUpdates() {
  $('#'+vm).removeClass('updatableVM');
  for ( vm in VMs ) {
    if ( VMs[vm]['updates-available'] == 1 ) {
      $('#'+vm).addClass('updatableVM');
      console.log('Update Available for: ' + vm);
    }
  }
}

///////////////////////////////////////////////////////////////////

/// THEME CONTROL
var bgimage = bgimage_file, bgcolor, txtcolor;

/// Initial setup of Theme files
function initializeTheme() {
  if ( !fs.existsSync(vms_css) ) {
    fs.writeFileSync(vms_css,'');
  }
  if ( !fs.existsSync(theme_css) || !fs.existsSync(bgimage_file) ) {
    // Use defaults
    console.log("Initializing Theme Files:\n" + theme_css + "\n" + bgimage_file);
    saveTheme(imgPath+'background-default.jpg','rgba(0,0,0,0.3)','rgba(255,255,255,0.9)');
  }
}

/// Change Colors and/or Background Image
function changeTheme() {
  bgimage = $('body').css('background-image').split('url(')[1].split(')')[0]
  bgimage = bgimage.replace('file://','');
  $('#setTheme').removeClass('hidden').children('span').remove();
  $('#bgimage').attr('src',imgPath+'chgbg.png').after('<span>Background Image</span>');

  $('#bgcolor').after('<span>Background Color</span>');
  bgcolor = $('body').css('background-image').split('gradient(')[1].split(' 0%')[0];
  $('#bgcolor').spectrum({
    preferredFormat: "rgb",
    color: bgcolor,
    showPalette: true,
    showInput: true,
    showAlpha: true,
    showButtons: false,
    move: function(c) {
      var temp = $('body').css('background-image').replace(bgcolor,c).replace(bgcolor,c);
      $('body').css('background-image',temp);
      bgcolor = c;
    }
  });

  $('#txtcolor').after('<span>Text Color</span>');
  txtcolor = $('body').css('color');
  $('#txtcolor').spectrum({
    preferredFormat: "rgb",
    color: txtcolor,
    showPalette: true,
    showInput: true,
    showAlpha: true,
    showButtons: false,
    move: function(c) {
      var temp = $('body').css('color').replace(txtcolor,c);
      $('body').css('color',temp);
      txtcolor = c;
    }
  });
}

/// Change Background
function selectBackground() {
  dialog.showOpenDialog({
    title: "Select Background Image",
    defaultPath: './',
    filters: [ {name: 'Images', extensions: ['jpg', 'png', 'gif']} ]
  },
    function (file) {
      if ( file !== undefined ) {
        file = '"'+file+'"';
        var type = execSync('file '+file).toString().split(': ')[1];
        if ( type.indexOf('image') !== -1 ) {
          console.log('Changing Background\nFrom:\t' + bgimage + '\nTo:\t\t' + file + '\nType:\t' + type);
          var temp = $('body').css('background-image').replace(bgimage.replace(/"/g,''),file.replace(/"/g,''));
          console.log( $('body').css('background-image') + '\n' + temp );
          $('body').css('background-image',temp);
          bgimage = file;
          themeInvert();
        }
      }
    }
  );
}

/// Check average brightness of background image
function getImageLightness(imageSrc,callback) {
    var img = document.createElement("img");
    img.src = imageSrc;
    img.style.display = "none";
    document.body.appendChild(img);
    var colorSum = 0;
    img.onload = function() {
        var canvas = document.createElement("canvas");
        canvas.width = this.width;
        canvas.height = this.height;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(this,0,0);
        var imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
        var data = imageData.data;
        var r,g,b,avg;
        for(var x = 0, len = data.length; x < len; x+=4) {
            r = data[x];
            g = data[x+1];
            b = data[x+2];
            avg = Math.floor((r+g+b)/3);
            colorSum += avg;
        }
        var brightness = Math.floor(colorSum / (this.width*this.height));
        callback(brightness);
    }
    img.remove();
}

/// Invert Cube Color if neccessary
function themeInvert() {
  bgimage = bgimage.replace(/"/g,'');
  getImageLightness(bgimage,function(brightness){
    if ( brightness < 128 ) {
      $('img.cubeicon[src*="black"]').each(function() {
        var lightimg = $(this).attr('src').replace('black','white');
        $(this).attr('src',lightimg);
      });
    } else if ( brightness >= 128 ) {
      $('img.cubeicon[src*="white"]').each(function() {
        var lightimg = $(this).attr('src').replace('white','black');
        $(this).attr('src',lightimg);
      });
    }
  });
}

/// Save theme to ccs file
function saveTheme(bgimage,bgcolor,txtcolor) {
  var css = "\n\
    body {\n\
      color: "+txtcolor+";\n\
      background-image: linear-gradient(\n\
          to bottom, "+bgcolor+" 0%, "+bgcolor+" 100%\n\
      ), url("+bgimage_file.replace(/"/g,'')+");\n\
    }\n\
  "
  if ( bgimage.replace(/"/g,'') != bgimage_file.replace(/"/g,'') ) {
    execSync('cp -vf "'+bgimage+'" "'+bgimage_file+'"');
  }
  fs.writeFileSync(theme_css,css,function(err) {
    if (err) console.error(err);
  });
  themeInvert();
}

///////////////////////////////////////////////////////////////////

/// CONTEXT MENUs
var label_move = "Unlock VM icons";
var icon_move = imgPath+'lock1.png';

/// Create context menu: body
const menu_body = new Menu()
function createMenu_background() {
  menu_body.append(new MenuItem({
      label: label_move,
      icon:  icon_move,
      click: function () { toggleMove(); }
    }))
  menu_body.append(new MenuItem({type: 'separator'}))
  menu_body.append(new MenuItem({
    label: "Theme Settings",
    icon: imgPath+'colorpick.png',
    click: function () { changeTheme(); }
  }))
  menu_body.append(new MenuItem({
    label: "Reload Dashboard",
    icon: imgPath+'qubes_small.png',
    role: 'reload'
  }))
}

/// Create context menu: VM
const menu_vm = new Menu()
function createMenu_VM(e) {
  var vm = $(e.target).parent('.vm').attr('id');
  var state = VMs[vm]['STATE'];

  if ( state == 'Halted' ) {
    menu_vm.append(new MenuItem({
      label: 'Start Qube',
      //icon:  icon_move,
      click: function () {
        exec('qvm-start ' + vm);
      }
    }))
  } else if ( state == 'Running' || state == 'Paused' ) {
    menu_vm.append(new MenuItem({
      label: 'Shutdown Qube',
      //icon:  icon_move,
      click: function () {
        exec('qvm-shutdown --wait ' + vm);
      }
    }))
  }
  if ( state == 'Running' ) {
    menu_vm.append(new MenuItem({
      label: 'Pause Qube',
      //icon:  icon_move,
      click: function () {
        console.log("Pausing VM: " + vm);
        exec('qvm-pause ' + vm);
      }
    }))
  }
  if ( state == 'Paused' ) {
    menu_vm.append(new MenuItem({
      label: 'Unpause Qube',
      //icon:  icon_move,
      click: function () {
        console.log("Unpausing VM: " + vm);
        exec('qvm-unpause ' + vm);
      }
    }))
  }
  if ( state == 'Running' || state == 'Paused' ) {
    menu_vm.append(new MenuItem({
      label: 'Restart Qube',
      //icon:  icon_move,
      click: function () {
        console.log("Restarting VM: " + vm);
        exec('qvm-shutdown --wait ' + vm + ' ; sleep 5 ; qvm-start ' + vm);
      }
    }))
  }
  menu_vm.append(new MenuItem({type: 'separator'}))
  if ( state != 'Killed' ) {
    menu_vm.append(new MenuItem({
      label: 'Kill Qube',
      //icon:  icon_move,
      click: function () {
        console.log("Killing VM: " + vm);
        exec('qvm-kill ' + vm);
      }
    }))
  }
  menu_vm.append(new MenuItem({type: 'separator'}))
  menu_vm.append(new MenuItem({
    label: 'Qube Settings',
    //icon:  icon_move,
    submenu: [
      {
        label: 'Basic Settings',
        //icon:  icon_move,
        click: function () { exec('qubes-vm-settings --tab basic ' + vm) }
      },
      {
        label: 'Advanced Settings',
        //icon:  icon_move,
        click: function () { exec('qubes-vm-settings --tab advanced ' + vm) }
      },
      {
        label: 'Firewall Rules',
        //icon:  icon_move,
        click: function () { exec('qubes-vm-settings --tab firewall ' + vm) }
      },
      {
        label: 'Applications',
        //icon:  icon_move,
        click: function () { exec('qubes-vm-settings --tab applications ' + vm) }
      }
    ]
  }))
  if ( VMs[vm]['CLASS'] == 'TemplateVM' || VMs[vm]['CLASS'] == 'StandaloneVM' ) {
    menu_vm.append(new MenuItem({
      label: 'Update Qube',
      //icon:  icon_move,
      click: function () {
        console.log("Updating VM: " + vm);
        exec('qvm-run --service ' + vm + ' qubes.InstallUpdatesGUI')
      }
    }))
  }
}

/// Create Left-Click menu: VM
const menu_apps = new Menu()
function createMenu_Apps(e) {
  var vm = $(e.target).parent('.vm').attr('id');
  //console.log(vm + ' - Creating App List for VM');
}

///////////////////////////////////////////////////////////////////
/*
function getActiveWindow() {
  var xprop = runX(
    "xprop -id $(xprop -root 32x '\t$0' _NET_ACTIVE_WINDOW | cut -f 2) _NET_WM_NAME",'remote','>>'
  );
  try {
    var win = xprop.split(' = ')[1];
    console.log('Current Active Window' + win);
  } catch (err) {
      err.stderr; err.pid; err.signal; err.status; console.error(err);
  }
}
*/
///////////////////////////////////////////////////////////////////

/// Set Click Event Listeners
function eventListeners() {
  createMenu_background();
  $('body').contextmenu(function() {
    menu_body.clear(); createMenu_background();
    menu_body.popup(remote.getCurrentWindow());
  })
  $('.vm').contextmenu(function(e) {
    e.stopPropagation();
    menu_vm.clear(); createMenu_VM(e);
    menu_vm.popup(remote.getCurrentWindow());
  });
  $('.vm').click(function(e) {
    if ( moving == 0 ) {
      menu_apps.clear(); createMenu_Apps(e);
      menu_apps.popup(remote.getCurrentWindow());
    }
  });
  $('#bgimage').click(function() {
    selectBackground();
  });
  $('#cancel').click(function() {
    location.reload();
  });
  $('#save').click(function() {
    saveTheme(bgimage,bgcolor,txtcolor);
    location.reload();
  });
  /* http://jsfiddle.net/7qqz33vm/120/
  function timerIncrement() {
  	if ( $("#on").is(":checked") && $("#idle").is(":checked") ) {
      idleTime = idleTime + 1;
      var duration = $("#delay").val();
      if ( idleTime > duration ) {
          // TURN OFF ANIMATION
          console.clear();
          console.log(idleTime);
      }
    }
  }*/
  $("#off").change(function(){
      if ( this.checked ) {
      	$("#idle,#delay,form>span").addClass('invalid').prop('disabled', true);
        // TURN OFF ANIMATION
      }
  });
  $("#on").change(function(){
      if ( this.checked ) {
      	$("#idle,#delay,form>span").removeClass('invalid').prop('disabled', false);
        // TURN ON ANIMATION
      }
  });
}

///////////////////////////////////////////////////////////////////

function netvmConnections() {
  jsPlumb.connect({
      source:"sys-net",
      target:"sys-firewall",
      endpoint:"Rectangle",
      anchor: "Continuous"
  });
  jsPlumb.connect({
      source:"sys-firewall",
      target:"INTERNET",
      endpoint:"Rectangle",
      anchor: "Continuous"
  });
}

function templateConnections() {
  jsPlumb.connect({
      source:"fedora-26",
      target:"sys-firewall",
      endpoint:"Dot",
      anchor: "Continuous"
  });
  jsPlumb.connect({
      source:"debian-9",
      target:"STORAGE",
      endpoint:"Dot",
      anchor: "Continuous"
  });
}

///////////////////////////////////////////////////////////////////

///////////////////////////////
/////////// MAIN RUN //////////
///////////////////////////////

jsPlumb.ready(function() {
  bindDevConsole();
  initializeTheme();
  loadcssfile(vms_css);
  loadcssfile(theme_css);
  //netvmConnections();
  //templateConnections();
  getVMs(3000);
  getPrefs(10000);
  getFeats(10000);
});
