exports.init = init;
var loadTime = Date.now();

function _getApp()
{
	var arg = sp.core.getArguments();
	return (arg.length != 0? arg[0]: null);
}

function _getArg()
{
	var arg = sp.core.getArguments();
	return (arg.length != 0? "spotify:app:" + arg.join(":"): null);
}

function init()
{
	sp = getSpotifyApi(1);
	if (sp.core.developer)
		document.body.classList.add('developer');

	sp.installer.addEventListener('metadataStarted',  _metadataStarted);
	sp.installer.addEventListener('metadataComplete', _metadataComplete);
	sp.installer.addEventListener('metadataFailed',   _metadataFailed);
	sp.installer.addEventListener('downloadStarted',  _downloadStarted);
	sp.installer.addEventListener('downloadComplete', _downloadComplete);
	sp.installer.addEventListener('downloadFailed',   _downloadFailed);
	sp.installer.addEventListener('installStarted',   _installStarted);
	sp.installer.addEventListener('installComplete',  _installComplete);
	sp.installer.addEventListener('installFailed',    _installFailed);
	_updateLogWithInitialState();

	sp.core.addEventListener('argumentsChanged', _updateViewForNewState);
	_updateViewForNewState();
	_installProgressUpdateTimer();

	var state = sp.installer.getApplicationState(_getApp());
	if (!state || state.step == "installComplete")
		_launchApplication();
}

function _updateLogWithInitialState()
{
	var state = sp.installer.getApplicationState(_getApp());
	_appendToLog(state? state.step: null, state);
}

function _appendToLog(message, state)
{
	if (state)
	{
		var log = document.getElementById('log');
		var row = document.createElement('div');
		var msg = document.createElement('div');
		var uri = document.createElement('div');
		var sum = document.createElement('div');
		var url = document.createElement('div');
		var ico = document.createElement('div');
		var err = document.createElement('div');
		row.classList.add(message);
		msg.classList.add('message');
		msg.classList.add(message);
		msg.innerText = message;
		uri.innerText = "URI: " + state.uri;
		sum.innerText = "Checksum: " + state.checksum;
		url.innerText = "URL: " + state.url;
		ico.innerText = "Icon: " + state.largeIconURL;
		err.innerText = "Error: " + state.error;
		row.appendChild(msg);
		row.appendChild(uri);
		if (state.checksum)
			row.appendChild(sum);
		if (state.url)
			row.appendChild(url);
		if (state.largeIconURL)
			row.appendChild(ico);
		if (state.error)
			row.appendChild(err);
		log.appendChild(row);
	}
}

function _metadataStarted(event)
{
	var app_id = event.data;
	if (app_id == _getApp())
	{
		var state = sp.installer.getApplicationState(app_id);
		_appendToLog("metadataStarted", state);
	}
}

function _metadataComplete(event)
{
	var app_id = event.data;
	if (app_id == _getApp())
	{
		var state = sp.installer.getApplicationState(app_id);
		_appendToLog("metadataComplete", state);
		_updateThumbnailIcon();
	}
}

function _metadataFailed(event)
{
	var app_id = event.data;
	if (app_id == _getApp())
	{
		var state = sp.installer.getApplicationState(app_id);
		_appendToLog("metadataFailed", state);
	}
}

function _downloadStarted(event)
{
	var app_id = event.data;
	if (app_id == _getApp())
	{
		var state = sp.installer.getApplicationState(app_id);
		_appendToLog("downloadStarted", state);
	}
}

function _downloadComplete(event)
{
	var app_id = event.data;
	if (app_id == _getApp())
	{
		var state = sp.installer.getApplicationState(app_id);
		_appendToLog("downloadComplete", state);
	}
}

function _downloadFailed(event)
{
	var app_id = event.data;
	if (app_id == _getApp())
	{
		var state = sp.installer.getApplicationState(app_id);
		_appendToLog("downloadFailed", state);
	}
}

function _installStarted(event)
{
	var app_id = event.data;
	if (app_id == _getApp())
	{
		var state = sp.installer.getApplicationState(app_id);
		_appendToLog("installStarted", state);
	}
}

function _installComplete(event)
{
	var app_id = event.data;
	if (app_id == _getApp())
	{
		var state = sp.installer.getApplicationState(app_id);
		_appendToLog("installComplete", state);
		_launchApplication();
	}
}

function _installFailed(event)
{
	var app_id = event.data;
	if (app_id == _getApp())
	{
		var state = sp.installer.getApplicationState(app_id);
		_appendToLog("installFailed", state);
	}
}

function _launchApplication()
{
	var diff = (Date.now() - loadTime);
	var wait = Math.max(0, 1000 - diff);

	setTimeout(function()
	{
		console.log("Waited for " + wait + " ms before launching app.");
		loadTime = Date.now();
		window.location.href = _getArg();
	},
	wait);
}

function _setIndeterminateProgress()
{
	var bar = document.getElementById('progress');
	bar.classList.remove('determinate');
	bar.classList.add('indeterminate');
	bar.classList.remove('hidden');
}

function _setDeterminateProgress(progress)
{
	var bar = document.getElementById('progress');
	bar.classList.add('determinate');
	bar.classList.remove('indeterminate');
	bar.classList.remove('hidden');

	var val = bar.getElementsByClassName('value')[0];
	val.style.width = (progress * 100) + '%';
}

function _hideProgressBar()
{
	var bar = document.getElementById('progress');
	bar.classList.add('hidden');
}

function _hideErrorMessage()
{
	var err = document.getElementById('error');
	err.classList.add('hidden');
}

function _showErrorMessage(state)
{
	if (state && _isErrorState(state))
	{
		var raw_messages = sp.core.readFile('errors.json');
		var messages = JSON.parse(raw_messages);
		var message = messages[state.step][state.error];

		var err = document.getElementById('error');
		err.classList.remove('hidden');
		err.innerText = message;
	}
}

function _removeThumbnailIcon()
{
	var icon = document.getElementById('icon');
	icon.classList.remove('loaded');

	var image = document.getElementById('icon');
	image.src = null;
}

function _updateThumbnailIcon(state)
{
	var image = document.getElementById('image');
	image.src = (state? state.largeIconURL: null);
}

function _isErrorState(state)
{
	if (state.step == "metadataFailed") return true;
	if (state.step == "downloadFailed") return true;
	if (state.step == "installFailed")  return true;
	return false;
}

function _updateProgressBar(state)
{
	if (state)
	{
		if (_isErrorState(state))
			_hideProgressBar();
		else if (state.progress < 0)
			_setIndeterminateProgress();
		else
			_setDeterminateProgress(state.progress);
	}
}

function _updateViewForCurrentState()
{
	var state = sp.installer.getApplicationState(_getApp());
	_updateThumbnailIcon(state);
	_updateProgressBar(state);
	_showErrorMessage(state);
}

function _updateViewForNewState()
{
	_hideErrorMessage();
	_removeThumbnailIcon();
	_setIndeterminateProgress()
	_updateViewForCurrentState();
}

function _installProgressUpdateTimer()
{
	setInterval(_updateViewForCurrentState, 1000);
}