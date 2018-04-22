const {remote} = require('electron');
const {dialog} = require('electron').remote;
const nativeImage = require('electron').remote.nativeImage
const {Menu, MenuItem} = remote
const prompt = require('electron-prompt');
const {exec, execSync} = require('child_process');
//const nativeImage = require('electron').remote.nativeImage;
const fs = require('fs');
const Store = require('./store.js');

const store = new Store({
  configName: 'user-preferences'
});

/// Set file paths
var resourcePath = process.resourcesPath;
var imgPath = resourcePath + '/imgfiles/';
var userDataPath = remote.app.getPath('userData');
var object_css = userDataPath+'/object.css';
var theme_css = userDataPath+'/theme.css';
var bgimage_file = userDataPath+'/background.jpg'

/// Define Workers
lsWorker   = new Worker("workers/qvm-ls_worker.js");
featWorker = new Worker("workers/qvm-feat_worker.js");
prefWorker = new Worker("workers/qvm-pref_worker.js");
usbWorker  = new Worker("workers/qvm-usb_worker.js");
pciWorker  = new Worker("workers/qvm-pci_worker.js");
micWorker  = new Worker("workers/qvm-mic_worker.js");
blkWorker  = new Worker("workers/qvm-blk_worker.js");

/// Set environment
var host = execSync('hostname').toString().trim();
if ( host == "dom0" ) { var dev = 0; } else { var dev = 1; }
var startdatetime = new Date().toLocaleString();
console.log("============>\tQubes Dashboard running on " + host + " at " + startdatetime);

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

/// Grep by Regex
function grep(arr,regex) {
  return $.grep(arr, function(elem) {
  	return elem.match(regex) != null;
  });
}

///////////////////////////////////////////////////////////////////
var VMs = {};

/// Query list of VMs with Preferences/Features
function getVMs(int) {
  lsWorker.postMessage({'dev':dev});
}
function getFeats(int){
  featWorker.postMessage({'dev':dev});
}
function getPrefs(int){
  prefWorker.postMessage({'dev':dev});
}

/// Receive list of VMs with Preferences/Features
lsWorker.onmessage = function(e) {
  var ls = e.data;
  var header = ls.split('\n')[0].toString().split(/\s+/g);
  var qvm_ls = ls.split('\n'); qvm_ls.shift()
  qvm_ls.forEach(function (item) {
    var item = item.split(/\s+/g);
    if ( item[0] != '' ) {
      if ( VMs[item[0]] === undefined ) { VMs[item[0]] = new Object(); }
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
featWorker.onmessage = function(e) {
  var feats = e.data.split('\n');
  feats.forEach(function (item) {
    var item = item.split(/\s+/g);
    if ( item[2] === undefined ) { item[2] = 0; }
    VMs[item[0]][item[1]] = item[2];
  });
  checkUpdates();
}
prefWorker.onmessage = function(e) {
  var prefs = e.data.split('\n');
  prefs.forEach(function (item) {
    var item = item.split(/\s+/g);
    VMs[item[0]][item[1]] = item[3];
  });
}

/// Get the state of the VM
function getState(vm) {
  if (
    VMs[vm]['STATE'] == 'Transient' &&
    VMs[vm]['CLASS'] == 'StandaloneVM' &&
    VMs[vm]['qrexec'] != '1'
  ) {
    var state = 'Running';
  } else {
    var state = VMs[vm]['STATE'];
  }
  return state
}

/// Set the board with VMs
function drawVMs() {
  console.log(VMs);
  var vm_positions = fs.readFileSync(object_css, 'utf8');
  for ( vm in VMs ) {
    var icon = 'cubes/' + VMs[vm]['LABEL'] + '.png';
    $('div.container').append('<div id='+vm+' class=vm>'+vm+'</div>');
    $('#'+vm).append('<img class=cubeicon src='+icon+'>');
    $('#dom0').children('img').attr('src','cubes/white.png');
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
    var state = getState(vm);
    if ( state == 'Running' && $('#'+vm+':not(.activeVM').length > 0 ) {
      var gif = $('#'+vm).children('img').attr('src').replace('.png','.png');
      $('#'+vm).removeClass('activeVM inactiveVM transientVM pausedVM');
      $('#'+vm).addClass('activeVM').children('img').attr('src',gif);
    }
    if ( state == 'Halted' && $('#'+vm+':not(.inactiveVM').length > 0 ) {
      var png = $('#'+vm).children('img').attr('src').replace('.gif','.png');
      $('#'+vm).removeClass('activeVM inactiveVM transientVM pausedVM');
      $('#'+vm).addClass('inactiveVM').children('img').attr('src',png);
    }
    if ( state == 'Transient' && $('#'+vm+':not(.transientVM').length > 0 ) {
      $('#'+vm).removeClass('activeVM inactiveVM transientVM pausedVM');
      $('#'+vm).addClass('transientVM');
    }
    if ( state == 'Paused' && $('#'+vm+':not(.transientVM').length > 0 ) {
      $('#'+vm).removeClass('activeVM inactiveVM transientVM pausedVM');
      $('#'+vm).addClass('pausedVM');
    }
  }
}

///////////////////////////////////////////////////////////////////
var Devices = {};

/// Query all Devices by type
function getDevices(int){
  usbWorker.postMessage({'dev':dev});
  pciWorker.postMessage({'dev':dev});
  micWorker.postMessage({'dev':dev});
  blkWorker.postMessage({'dev':dev});
}

usbWorker.onmessage = function(e) {
  console.log(e.data);
}
pciWorker.onmessage = function(e) {
  console.log(e.data);
}
micWorker.onmessage = function(e) {
  console.log(e.data);
}
blkWorker.onmessage = function(e) {
  console.log(e.data);
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
  fs.writeFileSync(object_css,'');
  for ( vm in VMs ) {
    var elem = $('#'+vm), id = elem.attr('id');
    var left = (elem.css('left').split('px')[0] / window.innerWidth * 100).toFixed(0) + '%';
    var top  = (elem.css('top').split('px')[0] / window.innerHeight * 100).toFixed(0) + '%';
    var line = '#' + id + ' { left: '+ left + '; top: ' + top + '; }\n'
    fs.appendFile(object_css,line,function(err) {
      if (err) console.error(err);
    });
  }
  location.reload();
}

/// Check for available updates for TemplateVMs
function checkUpdates() {
  $('.vm').removeClass('updatableVM');
  for ( vm in VMs ) {
    if ( VMs[vm]['updates-available'] == 1 ) {
      $('#'+vm).addClass('updatableVM');
      //console.log('Update Available for: ' + vm);
    }
  }
}

///////////////////////////////////////////////////////////////////

/// THEME CONTROL
var bgimage = bgimage_file, bgcolor, txtcolor;

/// Initial setup of Theme files
function initializeTheme() {
  if ( !fs.existsSync(object_css) ) {
    fs.writeFileSync(object_css,'');
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
  var vm = $(e.target).parent('.vm').attr('id') || $(e.target).attr('id');
  var state = getState(vm);
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
      label: 'Resume Qube',
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
  if ( state != 'Halted' ) {
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
  var vm = $(e.target).parent('.vm').attr('id') || $(e.target).attr('id');
  var appfiles = execSync(
    'ls -d ~/.local/share/qubes-appmenus/'+vm+'/apps/*.desktop | grep -v qubes-vm-settings'
  ).toString().split('\n');
  appfiles.forEach(function(appfile) {
    if ( appfile != '' ) {
      var appinfo = execSync('cat '+appfile).toString().split('\n');
      var appname = grep(appinfo,/^Name=/).toString().split(': ')[1];
      var appicon = grep(appinfo,/^Icon=/).toString().split('=')[1];
      var appexec = grep(appinfo,/^Exec=/).toString().split('=')[1];
      let appicon_native = nativeImage.createFromPath(appicon.toString().trim());
      menu_apps.append(new MenuItem({
        label: appname,
        icon:  appicon_native.resize({height: 30}),
        click: function () {
          console.log('Running: ' + appexec)
          exec(appexec)
        }
      }))
    }
  });
}

///////////////////////////////////////////////////////////////////

/// Set Event Listeners
function eventListeners() {
  $('body').mousemove(function() {
    idleTime = 0;
    activeTimer();
  });
  $('body').contextmenu(function() {
    menu_body.clear(); createMenu_background();
    menu_body.popup(remote.getCurrentWindow());
  });
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

/// Control the timing of Workers depending on idle
var idleTime = 0, counter = 0, ls_timer, feats_timer, prefs_timer, devs_timer;
var timing_active = {"getvms":3,"getfeats":60,"getprefs":600,"getdevs":600}; //seconds
var timing_idle   = {"getvms":30,"getfeats":120,"getprefs":1200,"getdevs":1200}; //seconds

/// Set short Worker intervals initially and on active mouse
function activeTimer() {
  if ( counter === 0 ) {
    getVMs(); getFeats(); getPrefs(); getDevices();
    setTimeout (function() { counter = 0; }, 10000);
  }; counter++;

  clearInterval(ls_timer   ); ls_timer    = setInterval(  getVMs, timing_active['getvms'  ] * 1000);
  clearInterval(feats_timer); feats_timer = setInterval(getFeats, timing_active['getfeats'] * 1000);
  clearInterval(prefs_timer); prefs_timer = setInterval(getPrefs, timing_active['getprefs'] * 1000);
  clearInterval(devs_timer ); devs_timer  = setInterval(getDevices, timing_active['getdevs'] * 1000);
}

/// After threshold timer is reached, set longer Worker intervals
function ildeTimer(threshold) {
  setInterval(function() {
    //console.log(idleTime);
    if ( idleTime == threshold ) {
      //var datetime = new Date().toLocaleString();
      //console.log("QubesDashboard Idle: " + idleTime + " seconds at " + datetime);
      clearInterval(ls_timer   ); ls_timer    = setInterval(  getVMs, timing_idle['getvms'  ] * 1000);
      clearInterval(feats_timer); feats_timer = setInterval(getFeats, timing_idle['getfeats'] * 1000);
      clearInterval(prefs_timer); prefs_timer = setInterval(getPrefs, timing_idle['getprefs'] * 1000);
      clearInterval(devs_timer ); devs_timer  = setInterval(getDevices, timing_idle['getdevs'] * 1000);
    }
    idleTime = idleTime + 1;
  }, 1000);
}

///////////////////////////////
/////////// MAIN RUN //////////
///////////////////////////////

$(document).ready(function() {
  bindDevConsole();
  initializeTheme();
  loadcssfile(object_css);
  loadcssfile(theme_css);
  //netvmConnections();
  //templateConnections();
  activeTimer();
  ildeTimer(60);
});
