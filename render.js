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

/// Set file paths
var resourcePath = process.resourcesPath;
var imgPath = resourcePath + '/imgfiles/';
var userDataPath = remote.app.getPath('userData');
var cmdDataCache = userDataPath+'/datacache/';
var vms_css = userDataPath+'/vms.css';
var theme_css = userDataPath+'/theme.css';
var bgimage_file = userDataPath+'/background.jpg'

/// Set environment
var host = execSync('hostname').toString().trim();
if ( !fs.existsSync(cmdDataCache) ) { execSync('mkdir '+cmdDataCache); }
if ( host == "dom0" ) { var devenv = 0; } else { var devenv = 1; }
console.log(
  "============>\tQubes Dashboard running on " + host + " mode " + devenv +
  '\nImagePath: ' + imgPath +
  '\nResourcePath: ' + resourcePath +
  '\nDataCache: ' + cmdDataCache +
  '\nUserPath: ' + userDataPath
);

/// Load additional css files
function loadcssfile(filePath) {
  $("<link/>", {
     rel: "stylesheet",
     type: "text/css",
     href: filePath
  }).appendTo("head");
}

/// Run a command on host system
function run(cmd,opt,stream) {
  var output = "";
  if ( opt != 'quiet' ) { console.log('Running: ' + cmd) }
  var cmdname = cmd.replace(/\W/g,'-');
  if ( devenv == 1 && opt != 'local' ) {
    try {
      exec('echo "'+cmd+'" > '+cmdDataCache+cmdname+'-input.dev');
      output = execSync('cat '+cmdDataCache+cmdname+'-output.dev');
    } catch (err) {
      err.stderr; err.pid; err.signal; err.status; console.error(err);
    }
  } else if ( devenv == 0 || opt == 'local' ) {
    try {
      if ( stream == 'async' ) {
        if ( devenv == 0 ) {
          exec(cmd+' > '+cmdDataCache+cmdname)
          output = fs.readFileSync(cmdDataCache+cmdname);
        } else {
          exec(cmd);
        }
      } else if ( devenv == 1 ) {
        output = execSync(cmd);
      }
    } catch (err) {
      err.stderr; err.pid; err.signal; err.status; console.error(err);
    }
  }
  return output.toString().trim();
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

/// Get updated info from qvm-ls
function getVMs() {
  var ls = run('qvm-ls','quiet','async');
  var head = ls.split('\n')[0].toString().split(/\s+/g);
  var qvm_ls = ls.split('\n'); qvm_ls.shift()
  buildVMs(head,qvm_ls);
}

/// Create object array with all VMs with basic attributes
function buildVMs(header,list) {
  list.forEach(function (item) {
    var item = item.split(/\s+/g);
    if ( item[0] != '' ) {
      VMs[item[0]] = new Object();
      item.forEach( function (val,index) {
        VMs[item[0]][header[index]] = val;
      });
    }
  })
  return VMs;
}

/// Add preference/feature attributes to VM object array
function buildAttributes() {
    Object.keys(VMs).forEach(function (vm) {
      var prefs = run('qvm-prefs ' + vm,'quiet','async').split('\n');
      var features = run('qvm-features ' + vm,'quiet','async').split('\n');
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
  //var usb = run('qvm-usb','quiet','async');
  //var pci = run('qvm-pci','quiet','async');
}

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
  refreshVMs();
}

/// Update VM status on board
function refreshVMs() {
  getVMs();
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
      if (err) throw err;
    })
  }
}

/// Check for available updates for TemplateVMs
function checkUpdates() {
  $('#'+vm).removeClass('updatableVM');
  for ( vm in VMs ) {
    if ( VMs[vm]['updates-available'] == 1 ) {
      $('#'+vm).addClass('updatableVM');
      console.log(vm + ' has an update available');
    }
  }
}

///////////////////////////////////////////////////////////////////

/// THEME CONTROL
var bgimage = bgimage_file, bgcolor, txtcolor;

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
        var type = run('file '+file,'local','sync').split(': ')[1];
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
    run('cp -f '+bgimage+' '+bgimage_file,'local','async');
  }
  fs.writeFileSync(theme_css,css,function(err) {
    if (err) throw err;
  });
  themeInvert();
}

///////////////////////////////////////////////////////////////////

/// Create context menu: body
const menu_body = new Menu()
var label_move = "Unlock VM icons", icon_move = imgPath+'lock1.png'
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
        run('qvm-start ' + vm,'','async')
      }
    }))
  } else if ( state == 'Running' || state == 'Paused' ) {
    menu_vm.append(new MenuItem({
      label: 'Shutdown Qube',
      //icon:  icon_move,
      click: function () {
        run('qvm-shutdown --wait ' + vm,'','async')
      }
    }))
  }
  if ( state == 'Running' ) {
    menu_vm.append(new MenuItem({
      label: 'Pause Qube',
      //icon:  icon_move,
      click: function () {
        console.log("Pausing VM: " + vm);
        run('qvm-pause ' + vm,'','async')
      }
    }))
  }
  if ( state == 'Paused' ) {
    menu_vm.append(new MenuItem({
      label: 'Unpause Qube',
      //icon:  icon_move,
      click: function () {
        console.log("Unpausing VM: " + vm);
        run('qvm-unpause ' + vm,'','async')
      }
    }))
  }
  if ( state == 'Running' || state == 'Paused' ) {
    menu_vm.append(new MenuItem({
      label: 'Restart Qube',
      //icon:  icon_move,
      click: function () {
        console.log("Restarting VM: " + vm);
        run('qvm-shutdown --wait ' + vm + ' ; sleep 5 ; qvm-start ' + vm,'','async')
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
        run('qvm-kill ' + vm,'','async')
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
        click: function () { run('qubes-vm-settings --tab basic ' + vm,'','async') }
      },
      {
        label: 'Advanced Settings',
        //icon:  icon_move,
        click: function () { run('qubes-vm-settings --tab advanced ' + vm,'','async') }
      },
      {
        label: 'Firewall Rules',
        //icon:  icon_move,
        click: function () { run('qubes-vm-settings --tab firewall ' + vm,'','async') }
      },
      {
        label: 'Applications',
        //icon:  icon_move,
        click: function () { run('qubes-vm-settings --tab applications ' + vm,'','async') }
      }
    ]
  }))
  if ( VMs[vm]['CLASS'] == 'TemplateVM' || VMs[vm]['CLASS'] == 'StandaloneVM' ) {
    menu_vm.append(new MenuItem({
      label: 'Update Qube',
      //icon:  icon_move,
      click: function () {
        console.log("Updating VM: " + vm);
        run('qvm-run --service ' + vm + ' qubes.InstallUpdatesGUI')
      }
    }))
  }
}

/// Create Left-Click menu: VM
const menu_apps = new Menu()
function createMenu_Apps(e) {
  var vm = $(e.target).parent('.vm').attr('id');
  console.log(vm + ' - Creating App List for VM');
}

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
  $('#bgimage').click(function(e) {
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

function heartbeat1(int) {
  setInterval( function() {
    if ( $('.vm').length == 0 ) { getVMs(); drawVMs(); }
    refreshVMs();
  },int)
}

function heartbeat2(int) {
  setInterval( function() {
    buildAttributes();
    checkUpdates();
  },int)
}

///////////////////////////////
/////////// MAIN RUN //////////
///////////////////////////////

jsPlumb.ready(function() {
  bindDevConsole();
  initializeTheme();
  loadcssfile(vms_css); loadcssfile(theme_css);
  getVMs();
  drawVMs();
  refreshVMs();
  themeInvert();
  //netvmConnections();
  //templateConnections();
  eventListeners();
  heartbeat1(5000);
  heartbeat2(60000);

});
