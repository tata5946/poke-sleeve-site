/*************************************************************/
/* 定数
/*************************************************************/
// イベント
const CHANGE_EVENT = 'change';
const DROP_EVENT = 'drop';

// ログ種別
const LOGTYPE_UPLOAD = 'LogtypeUpload';

/*************************************************************/
/* 各種イベントの設定
/*************************************************************/
document.addEventListener(CHANGE_EVENT, function(event){ changeEvent(event); }, true);
document.addEventListener(DROP_EVENT, function(event){ dropEvent(event); }, true);

/*************************************************************/
/* ファイル選択、フォルダー選択でアップロードする場合
/*************************************************************/
function changeEvent(event)
{
    var selectFile = null;

    var selectFileList = event.target.files;
    if (selectFileList)
    {
        for (var i = 0; i < selectFileList.length; i++)
        {
            selectFile = selectFileList[i];

            // アップロードファイル名を送信
            sendUploadFileName(selectFile.name);
        }
    }
};

/*************************************************************/
/* D&Dでアップロードする場合
/*************************************************************/
function dropEvent(event)
{
    var item = null;
    var dropEntry = null;

    var dropDataTransfer = event.dataTransfer;
    var tempItems = dropDataTransfer.items;
    if (dropDataTransfer && tempItems)
    {
        for (var i = 0; i < tempItems.length; i++)
        {
            item = tempItems[i];
            dropEntry = item.webkitGetAsEntry();

            // Entryを解析する
            analyzeEntry(dropEntry);
        }
    }
};

/*************************************************************/
/* Entryの解析処理
/*************************************************************/
function analyzeEntry(entry)
{
    if (entry.isFile)
    {
        // ファイルの場合はアップロードファイル名を送信
        sendUploadFileName(entry.name);
    }
    else if (entry.isDirectory)
    {
        // フォルダーの場合は再帰処理で深堀する
        var entryReader = entry.createReader();
        entryReader.readEntries(
            function(results)
            {
                for (var i = 0; i < results.length; i++)
                {
                    // 再度Entryを解析する
                    analyzeEntry(results[i]);
                }
            }
        );
    }
};

/*************************************************************/
/* アップロードされたファイル名を「LspWaoMeBackground.js」に送信する
/*************************************************************/
function sendUploadFileName(uploadFileName)
{
    if (uploadFileName)
    {
        // アップロードファイル名を送信
        chrome.runtime.sendMessage(
            {logType: LOGTYPE_UPLOAD, uploadFileName: uploadFileName}
        );
    }
};