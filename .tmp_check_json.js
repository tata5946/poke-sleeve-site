var fso = new ActiveXObject('Scripting.FileSystemObject');
var path = fso.GetAbsolutePathName('data.json');
var stream = new ActiveXObject('ADODB.Stream');
stream.Type = 2;
stream.Charset = 'utf-8';
stream.Open();
stream.LoadFromFile(path);
var text = stream.ReadText();
stream.Close();
var data = JSON.parse(text);
var sleeves = data && data.sleeves ? data.sleeves : [];
var usable = 0;
var names = [];
for (var i = 0; i < sleeves.length; i++) {
  var s = sleeves[i] || {};
  var id = String(s.id || '').replace(/^\s+|\s+$/g, '');
  var name = String(s.name || '').replace(/^\s+|\s+$/g, '');
  if (id || name) usable++;
  if (name) names.push(name);
}
WScript.Echo('usable=' + usable);
WScript.Echo('first=' + names.slice(0, 8).join(' | '));
