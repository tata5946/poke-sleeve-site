/*************************************************************/
/* 定数
/*************************************************************/
const BROWSE_TIME = 100;
const CONNECT_INTERVAL = 100;
const CONNECT_COUNT = 10;

// ログ情報のサイズ
const TITLE_LENGTH = 255;
const URL_LENGTH = 255;
const UPFILE_PATH_LENGTH = 65536;
const DLFILE_URL_LENGTH = 520;
const WRITE_LENGTH = 65536;

// 共有メモリ名
const SHAREDMEM_BROWSE = 'LspAddOnEdgeBrowseSharedMem';
const SHAREDMEM_UPLOAD = 'LspAddOnEdgeUploadSharedMem';
const SHAREDMEM_DOWNLOAD = 'LspAddOnEdgeDownloadSharedMem';
const SHAREDMEM_WEBMAIL = 'LspAddOnEdgeWebMailSharedMem';

const TAB = '\t';
const LINE_BREAK = '\r\n';
const RETURN = '\r';
const NEW_LINE = '\n';
const ALL_LINE_BREAK = '\r?\n|\r';
const HALF_SPACE = ' ';
const COMMA = ',';
const AMPERSAND = '&';
const VERTICAL_LINE = '|';
const UNDER_SCORE = '_';
const PERCENT = '%';
const ENCODEURI_PERCENT = '%25';
const DOUBLE_QUOTATION = '"';
const ASTERISK = '*';

// Gmailの表示形式
const GMAIL_SIMPLE = 0;
const GMAIL_SIMPLE_QUICK = 1;
const GMAIL_HTML = 2;

// メールのヘッダ
const HEADER_MAIL_FROM = 'From:';
const HEADER_MAIL_TO = 'To:';
const HEADER_MAIL_CC = 'Cc:';
const HEADER_MAIL_BCC = 'Bcc:';
const HEADER_MAIL_SUBJECT = 'Subject:';
const HEADER_MAIL_ATTACHMENT = 'Attachment:';
const HEADER_MAIL_BODY = 'Body:';
const SEMI_COLON = ';';

// リクエストヘッダ情報
const X_OWA_URLPOSTDATA = 'x-owa-urlpostdata';
const X_UPNANCHORMAILBOX = 'x-upnanchormailbox';
const X_ANCHORMAILBOX = 'x-anchormailbox';
const X_GOOGUPLOADFILENAME = 'x-goog-upload-file-name';

// リクエストヘッダ情報のプロパティ名
const HEADERS_URLPOSTDATA_MESSAGEDISPOSITION = 'messagedisposition';
const HEADERS_URLPOSTDATA_SENDMEETINGINVITATIONS = 'sendmeetinginvitations';
const HEADERS_URLPOSTDATA_SENDCALENDARINVITATIONSORCANCELLATIONS = 'sendcalendarinvitationsorcancellations';

// リクエストヘッダ情報の値
const TRIGGER_MAIL_OFFICE365_SENDANDSAVECOPY = 'sendandsavecopy';
const TRIGGER_MAIL_OFFICE365_SENDTOALLANDSAVECOPY = 'sendtoallandsavecopy';
const TRIGGER_MAIL_OFFICE365_SENDTOCHANGEDANDSAVECOPY = 'sendtochangedandsavecopy';

// コンテンツスクリプトで使用
const GET_UPFILENAME_GMAIL = 0;
const GET_FROMADDRESS_GMAIL = 1;
const GET_UPFILENAME_FROM_OFFICE365 = 2;
const SET_UPFILENAME_OFFICE365 = 3;
const GET_FROM_TO_GMAIL_QUICK = 4;
const SET_FROM_OFFICEONLINE = 5;

const EXTENSION_VER = '001';

// セッション
const SESSION_LAST_ACCESS_TAB_TITLE = 'LspLastAccessTabTitle';
const SESSION_OFFICE365FROM = 'LspOffice365From';
const SESSION_OFFICE365UPFILENAME = 'LspOffice365UpFileName';
const SESSION_OFFICEONLINEFROM = 'LspOfficeOnlineFrom';
const SESSION_STORAGEKEYLIST= 'LspStorageKeyList';

// アップロードログのオブジェクト
var gSendUploadLogList = new Array();

// ログ取得トリガー
// GoogleDriveのアップロード
const TRIGGER_UPLOAD_GOOGLEDRIVE = '/upload/resumableuploadsc?authuser=';
// office365の「One Driveファイルとしてアップロードして添付します」でアップロード
const TRIGGER_UPLOAD_OFFICE365_REFERENCE = 'CreateReferenceAttachmentFromLocalFile';
// office365の「コピーとして添付」でアップロード
const TRIGGER_UPLOAD_OFFICE365_ATTACHMENT = 'CreateAttachmentFromLocalFile';
// office365(Lightモード)でアップロード
const TRIGGER_UPLOAD_OFFICE365_LIGHT = 't=Attach';
// OneDrive(Office365)でアップロード
const TRIGGER_UPLOAD_ONEDRIVE_OFFICE365 = 'upload.aspx';
// OneDrive(Office365)でアップロード(容量の大きいファイルの場合)
const TRIGGER_UPLOAD_ONEDRIVE_OFFICE365_BIG = '/StartUpload';
// OneDrive(Office365)でアップロード(Office365でUIが新しい場合)
const TRIGGER_UPLOAD_ONEDRIVE_OFFICE365_201511 = 'GetFolderByServerRelativeUrl';
const TRIGGER_UPLOAD_ONEDRIVE_OFFICE365_201704 = 'GetFolderByServerRelativePath';
const TRIGGER_UPLOAD_ONEDRIVE_OFFICE365_201807 = 'GetFileByServerRelativePath';
const TRIGGER_UPLOAD_ONEDRIVE_OFFICE365_ADD_201807 = 'FinishUpload';
const TRIGGER_UPLOAD_ONEDRIVE_OFFICE365_FOLDER_201511 = 'getfolderbyid';
const TRIGGER_UPLOAD_ONEDRIVE_OFFICE365_ADD_201511 = '/Files/Add';
// Gmail(標準HTML)の「写真を挿入」でアップロード
const TRIGGER_UPLOAD_GMAIL_INLINE = '/upload/att?authuser=';
// Gmail(標準HTML)の「ファイルを添付」、D&D(インライン画像以外)でアップロード、
const TRIGGER_UPLOAD_GMAIL_ATTACH = '/upload?authuser=';
// Gmail(標準HTML)の「ファイルを添付」でアップロード(容量が25MB超の場合)
const TRIGGER_UPLOAD_GMAIL_ATTACH_LINK = '/upload/drive/resumable?authuser=';
// Gmail(標準HTML)のD&D(インライン画像)でアップロード
const TRIGGER_UPLOAD_GMAIL_INLINE_DD = 'view=trup';
// Outlook.comでアップロード
const TRIGGER_UPLOAD_OUTLOOKCOM = '/mail/SilverlightAttachmentUploader';
// DropBoxでアップロード
const TRIGGER_UPLOAD_DROPBOX_ENHANCE = 'commit_web_upload_by_token';
// DropBoxのファイルリクエスト機能でアップロード
const TRIGGER_UPLOAD_DROPBOX_REQUEST = 'commit_file_request_by_token';
// Gmail(簡易HTML)のアップロード、Webメール送信
const TRIGGER_GMAIL_URL_SIMPLE = '/?&fv=';
// Gmail(簡易HTML)のクイック返信でWebメール送信
const TRIGGER_GMAIL_URL_SIMPLE_QUICK = '/?&pv=';
// Gmail(簡易HTML)の「送信」でアップロード、Webメール送信
const TRIGGER_MAIL_GMAIL_SIMPLE_SEND = 'nvp_bu_send';
// Gmail(簡易HTML)の「添付ファイルを追加」でアップロード
const TRIGGER_UPLOAD_GMAIL_SIMPLE_SD = 'nvp_bu_sd';
// Gmail(簡易HTML)の「下書きを保存」でアップロード
const TRIGGER_UPLOAD_GMAIL_SIMPLE_AMF = 'nvp_bu_amf';
// Gmail(簡易HTML)の「完了」でアップロード
const TRIGGER_UPLOAD_GMAIL_SIMPLE_DONE = 'nvp_bu_done';
// Gmail(標準HTML)のWebメール送信
const TRIGGER_MAIL_GMAIL_URL_HTML_FIRST = '/sync/u/';
const TRIGGER_MAIL_GMAIL_URL_HTML_SECOND = '/i/s?';
// Outlook.comのWebメール送信
const TRIGGER_MAIL_OUTLOOKCOM = 'MailBox.SendMessage';
// office365の「編集」でWebメール送信
const TRIGGER_MAIL_OFFICE365_UPDATE = '/service.svc?action=UpdateItem';
// office365の「新規作成」でWebメール送信
const TRIGGER_MAIL_OFFICE365_CREATE = '/service.svc?action=CreateItem';
// office365の「グループ会話」でWebメール送信
const TRIGGER_MAIL_OFFICE365_POSTGROUP = '/service.svc?action=PostGroupItem';
// OneDrive(Outlook.com)のルートディレクトリにアップロード
const TRIGGER_UPLOAD_OUTLOOKCOM_LIVEFOLDERS = '/LiveFolders/';
// OneDrive(Outlook.com)のフォルダにアップロード
const TRIGGER_UPLOAD_OUTLOOKCOM_ITEMS = '/items/';
// OneDrive(Outlook.com)にアップロード(2017年06月発見)
const TRIGGER_UPLOAD_OUTLOOKCOM_201706 = ':/upload.createSession';
// OneDrive(Outlook.com)にアップロード(2017年07月発見)
const TRIGGER_UPLOAD_OUTLOOKCOM_201707 = ':/oneDrive.createUploadSession';
// outlook処理全般に含まれるURL
const TRIGGER_OUTLOOK = 'outlook';
// office365処理全般に含まれるURL
const TRIGGER_OFFICE365 = 'outlook.office';
// office365のFrom情報取得
const TRIGGER_SAVE_FROM_OFFICE365 = 'getmailboxbyidentity';
// OfficeOnline処理全般に含まれるURL
const TRIGGER_OFFICEONLINE = 'outlook.live';
// メール送信後、添付ファイル名を取得するまでに送られてくる不要な通信
const TRIGGER_OUTLOOK_REMOVE_URL = 'appsforoffice.microsoft.com';
// ChatGPT投稿時にPOSTする先
const TRIGGER_CHATGPT_POST_URL_OLD = 'chat.openai.com/backend-api/conversation';
const TRIGGER_CHATGPT_POST_URL_FREE_OLD = 'chat.openai.com/backend-anon/conversation';
const TRIGGER_CHATGPT_POST_URL = /^https:\/\/chatgpt\.com\/backend(?:-[^/]+(?:\/[^/]*)?)\/conversation$/;
// 添付ファイル削除時に含まれるURL
const TRIGGER_OFFICE365_DELETE = 'DeleteAttachment';

// バイト数
const BYTE_10000 = 10000;

// ログ種別
const LOGTYPE_UPLOAD = 'LogtypeUpload';

/*************************************************************/
/* グローバル変数
/*************************************************************/
var port;
var isFocusedWindow = false;
var connectCount = 0;
var intervalId = 0;
var uploadLogIntervalId = 0;
var browsingCount = 0;
var uploadCount = 0;
var send_URL = '';

/*************************************************************/
/* sleep用関数
/*************************************************************/
function sleep(waitSec, callbackFunc) 
{
    // 経過時間（秒）
    var spanedSec = 0;

    // 1秒間隔で無名関数を実行
    var id = setInterval(function () 
    {
        spanedSec++;
        
        // 経過時間 >= 待機時間の場合、待機終了。
        if (spanedSec >= waitSec) 
        {
            // タイマー停止
            clearInterval(id);
            // 完了時、コールバック関数を実行
            if (callbackFunc) callbackFunc();
        }
    }, 1000);
}

/*************************************************************/
/* 共有メモリ書き込み用仲介モジュールに接続
/*************************************************************/
function regist()
{
    const LSPWAOGCTOMR_CONNECT = 'LspWaoGcToMRConnect'
    const CONNECT_KEY = 'lspwaogctomr'

    // レジストリのキーに大文字を使うと正しく接続できなかったため、小文字にする
    port = chrome.runtime.connectNative(CONNECT_KEY);
    var jLogInfo = JSON.stringify(LSPWAOGCTOMR_CONNECT);
    var jobj = JSON.parse(jLogInfo);
    port.postMessage(jobj);
    port.onDisconnect.addListener(
        function(msg)
        {
            if (connectCount < CONNECT_COUNT)
            {
                window.setTimeout(regist, CONNECT_INTERVAL);
                connectCount++;
            }
            else
            {
                // 閲覧イベントの削除
                if (intervalId != 0)
                {
                    window.clearInterval(intervalId);
                }
                // アップロードログイベントの削除
                if (uploadLogIntervalId != 0)
                {
                    window.clearInterval(uploadLogIntervalId);
                }

                // webRequest.onBeforeRequestのイベント削除
                if (chrome.webRequest.onBeforeRequest.hasListener(webBeforeRequest))
                {
                    chrome.webRequest.onBeforeRequest.removeListener(webBeforeRequest);
                }
                // webRequest.onBeforeSendHeadersのイベント削除
                if (chrome.webRequest.onBeforeSendHeaders.hasListener(webBeforeSendHeaders))
                {
                    chrome.webRequest.onBeforeSendHeaders.removeListener(webBeforeSendHeaders);
                }
                // downloads.onCreatedのイベント削除
                if (chrome.downloads.onCreated.hasListener(lspWaoGcDownloadLog))
                {
                    chrome.downloads.onCreated.removeListener(lspWaoGcDownloadLog);
                }
            }
        }
    );
}

regist();

/*************************************************************/
/* 仲介モジュールとの接続成功時に再接続回数をリセットする
/*************************************************************/
port.onMessage.addListener(function(msg)
{
    const RESPONSE_TRUE = 'true';

    if (msg.Result == RESPONSE_TRUE)
    {
        // 接続成功時にイベントを設定する
        setEventAddListener(msg.UploadLogInterval);
        connectCount = 0;
    }
});

/*************************************************************/
/* 共有メモリ書き込み用仲介モジュールにログ情報送信
/*************************************************************/
function createLog(logInfo)
{
    var rest = 0;
    var diff = 0;
    var byteNum = 0;

    var jLogInfo = JSON.stringify(logInfo);

    // 仲介モジュールに渡す値が「256バイトの倍数+26バイト」の場合や
    // 2573バイト、6656～6911バイトの場合に
    // 仲介モジュールで正しく値が受け取れないことが発生したため、
    // 固定長で仲介モジュールに値を渡すようにし、
    // 固定長より少ない場合は、ログ情報の後を「*」で固定長まで埋める。
    // (10000バイト以下は10000バイト、20000バイト以下は20000バイト、以降同様)
    byteNum = getByteStr(jLogInfo);
    rest = byteNum % BYTE_10000
    if (rest != 0)
    {
        // 固定長までの残り文字数を求める
        diff = BYTE_10000 - rest;
        // 文字列の最後の「"」を省く
        jLogInfo = jLogInfo.substring(0, jLogInfo.length - 1);
        // 固定長 - 1まで「*」で埋める
        for (var i = 0; i < diff; i++)
        {
            jLogInfo += ASTERISK;
        }
        // 最後に省いた「"」を加える
        jLogInfo += DOUBLE_QUOTATION;
    }
    var jobj = JSON.parse(jLogInfo);
    port.postMessage(jobj);
}

/*************************************************************/
/* バイナリデータ変換
/*************************************************************/
var buff2str = function(buff)
{
    var size = buff.length;
    var ii = 0, str = '', c, code;
    while (ii < size)
    {
        c = buff[ii];
        if (c < 128)
        {
            str += String.fromCharCode(c);
            ii++;
        }
        else if ((c ^ 0xc0) < 32)
        {
            code = ((c ^ 0xc0) << 6) | (buff[ii + 1] & 63);
            str += String.fromCharCode(code);
            ii += 2;
        }
        else
        {
            code = ((c & 15) << 12) | ((buff[ii + 1] & 63) << 6) | (buff[ii + 2] & 63);
            str += String.fromCharCode(code);
            ii += 3;
        }
    }
    return str;
};

/*************************************************************/
/* 文字列置換
/*************************************************************/
function replaceBeforeToAfter(value, before, after)
{
    const FLG_ALL_REPLACE = 'g';
    var result = '';
    // 置換対象の正規表現を作成
    // (例：/[0-9]+/g ←を作成するときはbeforeに「[0-9]+」を格納する)
    var pattern = new RegExp(before, FLG_ALL_REPLACE);

    result = new String(value).replace(pattern, after);
    return result;
};

/*************************************************************/
/* アップロードログの共有メモリ書き込み
/*************************************************************/
function sendUploadLog()
{
    var activeTitle = '';
    var activeUrl = '';
    var upFile = '';
    var upCount = 0;
    var uploadInfo = '';
    var len = 0;

    // 送信するアップロードログが存在するか
    len = gSendUploadLogList.length;
    if (len > 0)
    {
        var logInfo = gSendUploadLogList.shift();
        activeTitle = logInfo[0];
        activeUrl = logInfo[1];
        upFile = cutMaxLengthStr(logInfo[2], UPFILE_PATH_LENGTH);

        // アップロードファイル数カウント
        var pos = upFile.indexOf(TAB);
        while (pos != -1)
        {
            upCount++;
            pos = upFile.indexOf(TAB, pos + 1);
        }

        // ログ情報連結
        uploadInfo = activeUrl.length + TAB + activeUrl + TAB
                   + activeTitle.length + TAB + activeTitle + TAB
                   + upCount + TAB + upFile.length + TAB + upFile;

        createLog(EXTENSION_VER + TAB + SHAREDMEM_UPLOAD + TAB + uploadInfo);
    }
}

/*************************************************************/
/* アップロードログ情報をセット
/*************************************************************/
function setUploadLog(uploadFileName)
{
    var ii = 0;
    var len = gSendUploadLogList.length;
    var isExist = false;
    var logInfoSource = null;
    var logInfo = new Array();

    // タイトル、URL取得
    var activeWindowId = '';
    var activeTitle = '';
    var activeUrl = '';
    
    if (uploadFileName != '')
    {
        chrome.windows.getCurrent(
            function(window)
            {
                activeWindowId = window.id;
                chrome.tabs.query(
                    {active: true}
                    , function(result)
                     {
                         for (var i = 0; i < result.length; i++)
                         {
                             if (activeWindowId == result[i].windowId)
                             {
                                 activeTitle = cutMaxLengthStr(result[i].title, TITLE_LENGTH);
                                 activeUrl = cutMaxLengthStr(result[i].url, URL_LENGTH);

                                 // 送信するアップロードログが存在するか
                                 if (len > 0)
                                 {
                                     for (ii = 0; ii < len; ii++)
                                     {
                                         // アップロード元が同じか
                                         logInfoSource = gSendUploadLogList[ii];
                                         if (logInfoSource != undefined && logInfoSource[1] == activeUrl)
                                         {
                                             isExist = true;
                                             break;
                                         }
                                     }

                                     if (isExist)
                                     {
                                         // アップロード元が同じ場合はアップロードファイル名を連結する
                                         gSendUploadLogList[ii][2] = gSendUploadLogList[ii][2] + uploadFileName + TAB;
                                     }
                                     else
                                     {
                                         // 送信するアップロードログを格納
                                         logInfo[0] = activeTitle;
                                         logInfo[1] = activeUrl;
                                         logInfo[2] = uploadFileName + TAB;
                                         gSendUploadLogList.push(logInfo);
                                     }
                                 }
                                 else
                                 {
                                     // 送信するアップロードログを格納
                                     logInfo[0] = activeTitle;
                                     logInfo[1] = activeUrl;
                                     logInfo[2] = uploadFileName + TAB;
                                     gSendUploadLogList.push(logInfo);
                                 }
                             }
                         }
                     }
                );
            }
        );
    }
}

/*************************************************************/
/* Webメール送信ログの共有メモリ書き込み
/*************************************************************/
function sendWebMailLog(mail, url)
{
    // 同一URLでのログ化防止用に保持
    send_URL = decodeURIComponent(url);
    var activeWindowId = '';
    var activeTitle = '';
    var activeUrl = '';

    chrome.windows.getCurrent(
        function(window)
        {
            activeWindowId = window.id;
            chrome.tabs.query(
                {active: true}
                , function(result)
                  {
                      for (var i = 0; i < result.length; i++)
                      {
                          if (activeWindowId == result[i].windowId)
                          {
                              activeTitle = cutMaxLengthStr(result[i].title, TITLE_LENGTH);
                              activeUrl = cutMaxLengthStr(result[i].url, URL_LENGTH);
                          }
                      }
                      mail = cutMaxLengthStr(mail, WRITE_LENGTH);
                      var webMailInfo = activeUrl.length + TAB + activeUrl + TAB
                                      + activeTitle.length + TAB + activeTitle + TAB
                                      + mail.length + TAB + mail;
                      createLog(EXTENSION_VER + TAB + SHAREDMEM_WEBMAIL + TAB + webMailInfo);
                  }
            );
        }
    );
    sleep(3, function ()
    {
        // 3秒後に同一ログ防止用の保持情報を初期化
        send_URL = '';
    });
}

/*************************************************************/
/* 最大サイズでの文字列カット処理
/* 指定された最大サイズで文字列をカットする
/*************************************************************/
function cutMaxLengthStr(targetStr, maxLen)
{
    // サロゲートペア
    const HIGHSURROGATE_FROM = 0xD800;
    const HIGHSURROGATE_TO = 0xDBFF;
    const LOWSURROGATE_FROM = 0xDC00;
    const LOWSURROGATE_TO = 0xDFFF;

    var ii = 0;
    var len = targetStr.length;
    var cutCnt = 0;
    var result = '';
    var tmpStr = targetStr;
    var high = 0;
    var low = 0;

    for (ii = 0; ii < len; ii++)
    {
        high = targetStr.charCodeAt(ii);
        low = targetStr.charCodeAt(ii + 1);

        // サロゲートペアチェック
        if ((HIGHSURROGATE_FROM <= high && high <= HIGHSURROGATE_TO) &&
            (LOWSURROGATE_FROM <= low && low <= LOWSURROGATE_TO))
        {
            // サロゲートペアはlengthが2なので0～2までsubstringする
            result += tmpStr.substring(0, 2);
            tmpStr = tmpStr.substring(2, tmpStr.length);
            ii += 1;
        }
        else
        {
            // 通常の文字はlengthが1なので0～1までsubstringする
            result += tmpStr.substring(0, 1);
            tmpStr = tmpStr.substring(1, tmpStr.length);
        }

        cutCnt += 1;
        // 最大サイズまでカットしたら終了
        if (cutCnt == maxLen)
        {
            break;
        }
    }
    return result;
}

/*************************************************************/
/* 文字列のバイト数計算処理
/*************************************************************/
function getByteStr(targetStr)
{
    var result = 0;

    // URIエンコードした後「%」から始まる3文字を「*」に置き換え、
    // 文字数をバイト数として計算する。
    // 例:encodeURI("あ")は、"%E3%81%82"になり、置換すると「***」で3バイトと計算できる。
    //    4バイト文字も同様に計算できる。
    result = encodeURI(targetStr).replace(/%[0-9A-F]{2}/g, ASTERISK).length;
    return result;
}

/*************************************************************/
/* 文字列の存在確認
/*************************************************************/
function isIndexOf(value, str)
{
    var result = false;
    if (value.toLowerCase().indexOf(str.toLowerCase()) > -1)
    {
        result = true;
    }
    return result;
}

/*************************************************************/
/* 文字列位置取得処理(後方から検索)
/*************************************************************/
function getTargetLastIndex(baseStr, targetStr)
{
    return baseStr.toLowerCase().lastIndexOf(targetStr.toLowerCase());
}

/*************************************************************/
/* office365の10KB未満のアップロード、
/* office365の予定表、タスクのアップロードログ
/* (1ログ1ファイル)
/*************************************************************/
function getUploadLog365Calendar(headers)
{
    for (var i = 0; i < headers.length; i++)
    {
        var urlPostdata = '';
        if (headers[i].name.toLowerCase() == X_OWA_URLPOSTDATA)
        {
            // デコード
            urlPostdata = decodeURIComponent(headers[i].value);
            // アップロードファイル名を取得
            urlPostdata = getUploadFileNameOffice365(urlPostdata);

            // アップロードログ情報をセット
            setUploadLog(urlPostdata);
        }
    }
}

/*************************************************************/
/* office365でファイルアップロード時にファイル名を抽出する
/*************************************************************/
function getUploadFileNameOffice365(urlPostdata)
{
    const ATTACHMENTS = 'Attachments';
    const NAME = 'Name":"';

    var result = '';
    // Attachmentsのindexを取得
    var indexS = urlPostdata.indexOf(ATTACHMENTS);
    // Attachments以下を取得
    urlPostdata = urlPostdata.substring(indexS);
    // Nameのindexを取得
    indexS = urlPostdata.indexOf(NAME);
    // Name以下を取得
    urlPostdata = urlPostdata.substring(indexS + NAME.length);
    // 「"」のindexを取得
    var indexE = urlPostdata.indexOf(DOUBLE_QUOTATION);
    // アップロードファイル名を取得
    result = urlPostdata.substring(0, indexE);

    return result;
}

/*************************************************************/
/* office365のWebメール送信ログ
/*************************************************************/
function getWebMailLogOffice365(headers, url, tabId)
{
    var sendMailFlg = false;
    var mailTo = '';
    var mailCc = '';
    var mailBcc = '';
    var mailFrom = '';
    var jsonObj;
    var tmpJsonObj;
    var postdataMsgDisPosition = '';
    var postdataSendMeeting = '';
    var postdataSendCalendar = '';
    var activeWindowId = '';
    var upFileName = '';

    for (var i = 0; i < headers.length; i++)
    {
        var urlPostdata = '';
        if (headers[i].name.toLowerCase() == X_OWA_URLPOSTDATA)
        {
            urlPostdata = decodeURIComponent(headers[i].value);

            // Json形式に変換し、ログ検知トリガーの値を取得する
            var jsonObj = JSON.parse(urlPostdata);
            postdataMsgDisPosition = getValueFromJson(jsonObj.Body, HEADERS_URLPOSTDATA_MESSAGEDISPOSITION);
            postdataSendMeeting = getValueFromJson(jsonObj.Body, HEADERS_URLPOSTDATA_SENDMEETINGINVITATIONS);
            postdataSendCalendar = getValueFromJson(jsonObj.Body, HEADERS_URLPOSTDATA_SENDCALENDARINVITATIONSORCANCELLATIONS);

            // office365のメール送信、office365のグループ会話からメール送信でログ取得
            if (postdataMsgDisPosition.toLowerCase() == TRIGGER_MAIL_OFFICE365_SENDANDSAVECOPY
                || isIndexOf(url, TRIGGER_MAIL_OFFICE365_POSTGROUP))
            {
                // Jsonに変換してメール情報を取得する
                jsonObj = JSON.parse(urlPostdata);
                tmpJsonObj = {mailFrom: '', mailLogTo: new Array(), mailLogCc: new Array(), mailLogBcc: new Array(), mailLogSubject: '', mailLogBody: ''};
                getMailValueOffice365(jsonObj.Body, tmpJsonObj);

                // To
                for (var ii = 0; ii < tmpJsonObj.mailLogTo.length; ii++)
                {
                    if (mailTo != '')
                    {
                        mailTo += SEMI_COLON;
                    }
                    mailTo += tmpJsonObj.mailLogTo[ii];
                }
                // Cc
                for (var ii = 0; ii < tmpJsonObj.mailLogCc.length; ii++)
                {
                    if (mailCc != '')
                    {
                        mailCc += SEMI_COLON;
                    }
                    mailCc += tmpJsonObj.mailLogCc[ii];
                }
                // Bcc
                for (var ii = 0; ii < tmpJsonObj.mailLogBcc.length; ii++)
                {
                    if (mailBcc != '')
                    {
                        mailBcc += SEMI_COLON;
                    }
                    mailBcc += tmpJsonObj.mailLogBcc[ii];
                }
                sendMailFlg = true;
            }
            // office365の予定表からメール送信でログ取得
            else if (postdataSendMeeting.toLowerCase() == TRIGGER_MAIL_OFFICE365_SENDTOALLANDSAVECOPY
                     || postdataSendCalendar.toLowerCase() == TRIGGER_MAIL_OFFICE365_SENDTOALLANDSAVECOPY
                     || postdataSendCalendar.toLowerCase() == TRIGGER_MAIL_OFFICE365_SENDTOCHANGEDANDSAVECOPY)
            {
                jsonObj = JSON.parse(urlPostdata);
                tmpJsonObj = {mailLogTo: new Array(), mailLogSubject: '', mailLogBody: ''};
                getMailValueOffice365Schedule(jsonObj, tmpJsonObj);

                // To
                for (var ii = 0; ii < tmpJsonObj.mailLogTo.length; ii++)
                {
                    if (mailTo != '')
                    {
                        mailTo += SEMI_COLON;
                    }
                    mailTo += tmpJsonObj.mailLogTo[ii];
                }
                sendMailFlg = true;
            }
        }
    }

    if (sendMailFlg)
    {
        // 本文の特殊文字を入力された文字に変換する
        tmpJsonObj.mailLogBody = replaceSpecialChar(tmpJsonObj.mailLogBody);
        
        // Fromの取得
        if (headers[i].name.toLowerCase() == X_UPNANCHORMAILBOX
            || headers[i].name.toLowerCase() == X_ANCHORMAILBOX)
        {
            mailFrom = decodeURIComponent(headers[i].value);
        } 
        else
        {
            mailFrom = tmpJsonObj.mailFrom;
        }
        
        chrome.windows.getCurrent(
            function(window)
            {
                activeWindowId = window.id;
                chrome.tabs.query(
                    {active: true}
                    , function(result)
                      {
                          for (var i = 0; i < result.length; i++)
                          {
                              if (activeWindowId == result[i].windowId)
                              {
                                  chrome.tabs.sendMessage(
                                      result[i].id
                                      , {action: GET_UPFILENAME_FROM_OFFICE365}
                                      , function(response)
                                        {               
                                            upFileName = '';
                                            if (response != undefined)
                                            {
                                                // 添付ファイル名取得
                                                var index = response.indexOf(ASTERISK);
                                                upFileName = response.substring(0, index);
                                                if (upFileName)
                                                {
                                                    upFileName = replaceSpecialChar(upFileName);
                                                }
                                                
                                                // From情報がない時にresponseから取得する
                                                if (!mailFrom)
                                                {
                                                    mailFrom = response.substring(index + 1);
                                                }
                                            }
                                            
                                            // 別ウィンドウで表示したときの添付ファイル名が存在している場合、
                                            // 保持したデータを参照する
                                            chrome.storage.local.get(
                                                [SESSION_OFFICE365UPFILENAME, SESSION_OFFICEONLINEFROM]
                                                , function(value) 
                                                  {
                                                      var storageUpFileName = value[SESSION_OFFICE365UPFILENAME];
                                                      if (storageUpFileName)
                                                      {
                                                          upFileName = replaceSpecialChar(storageUpFileName);
                                                      }
                                                      
                                                      // From情報がない場合、保持したデータを参照する
                                                      if (!mailFrom)
                                                      {
                                                          mailFrom = value[SESSION_OFFICEONLINEFROM];
                                                      }
                                                      
                                                      // ログ情報格納
                                                      var sendMailInfo = '';
                                                      sendMailInfo = getWebMailInfo(mailFrom, mailTo, mailCc, mailBcc, 
                                                          tmpJsonObj.mailLogSubject, upFileName, tmpJsonObj.mailLogBody);
                                                      if (mailTo != '' || mailCc != '' || mailBcc != '') 
                                                      {
                                                          // 共有メモリ書き込み
                                                          sendWebMailLog(sendMailInfo, url);
                                                      }
                                                  }
                                            );
                                        }
                                  );
                                  break;
                              }
                          }
                      }
                );
            }
        );
        // 即座に取得した場合、操作実行前の添付ファイル情報が取得されるため、遅延取得する
        sleep(1, function ()
        {
            // 添付ファイル情報を取得
            setSessionAttachmentOffice365(false);
        });
    }
}

/*************************************************************/
/* office365のWebメール送信ログ(本文の文字数が多い場合)
/*************************************************************/
function getWebMailLogOffice365Request(details)
{
    var sendMailFlg = false;
    var mailTo = '';
    var mailCc = '';
    var mailBcc = '';
    var mailFrom = '';
    var jsonObj;
    var tmpJsonObj;
    var postdataMsgDisPosition = '';
    var postdataSendMeeting = '';
    var postdataSendCalendar = '';
    var activeWindowId = '';
    var strOffice365Data = '';
    var sumLength = 0;
    var pos = 0;

    if (details.requestBody.raw)
    {
        if (details.requestBody.raw.length > 0)
        {
            if (details.requestBody.raw[0].bytes)
            {
                // リクエストデータの全体容量取得
                for(var ii = 0; ii < details.requestBody.raw.length; ii++)
                {
                    sumLength += details.requestBody.raw[ii].bytes.byteLength;
                }
                // 取得した容量を元にメモリ確保
                var buff = new Uint8Array(sumLength);
                // リクエストデータを取得
                for(var ii = 0; ii < details.requestBody.raw.length; ii++)
                {
                    buff.set(new Uint8Array(details.requestBody.raw[ii].bytes), pos);
                    pos += details.requestBody.raw[ii].bytes.byteLength;
                }
                // バイト⇒文字列変換
                strOffice365Data = strOffice365Data + new TextDecoder('utf-8').decode((buff));

                if (strOffice365Data != '')
                {
                    // 「%」を「%25」に置換し、decodeURI()でデコードできるようにする
                    strOffice365Data = replaceBeforeToAfter(strOffice365Data, PERCENT, ENCODEURI_PERCENT);
                    // デコード
                    var decodeStr = decodeURIComponent(strOffice365Data);
                    // Json形式に変換
                    var jsonObj = JSON.parse(decodeStr);

                    postdataMsgDisPosition = getValueFromJson(jsonObj.Body, HEADERS_URLPOSTDATA_MESSAGEDISPOSITION);
                    postdataSendMeeting = getValueFromJson(jsonObj.Body, HEADERS_URLPOSTDATA_SENDMEETINGINVITATIONS);
                    postdataSendCalendar = getValueFromJson(jsonObj.Body, HEADERS_URLPOSTDATA_SENDCALENDARINVITATIONSORCANCELLATIONS);

                    // office365のメール送信、office365のグループ会話からメール送信でログ取得
                    if (postdataMsgDisPosition.toLowerCase() == TRIGGER_MAIL_OFFICE365_SENDANDSAVECOPY
                        || isIndexOf(details.url, TRIGGER_MAIL_OFFICE365_POSTGROUP))
                    {
                        // Jsonに変換してメール情報を取得する
                        tmpJsonObj = {mailFrom: '', mailLogTo: new Array(), mailLogCc: new Array(), mailLogBcc: new Array(), mailLogSubject: '', mailLogBody: ''};
                        getMailValueOffice365(jsonObj.Body, tmpJsonObj);

                        // To
                        for (var ii = 0; ii < tmpJsonObj.mailLogTo.length; ii++)
                        {
                            if (mailTo != '')
                            {
                                mailTo += SEMI_COLON;
                            }
                            mailTo += tmpJsonObj.mailLogTo[ii];
                        }
                        // Cc
                        for (var ii = 0; ii < tmpJsonObj.mailLogCc.length; ii++)
                        {
                            if (mailCc != '')
                            {
                                mailCc += SEMI_COLON;
                            }
                            mailCc += tmpJsonObj.mailLogCc[ii];
                        }
                        // Bcc
                        for (var ii = 0; ii < tmpJsonObj.mailLogBcc.length; ii++)
                        {
                            if (mailBcc != '')
                            {
                                mailBcc += SEMI_COLON;
                            }
                            mailBcc += tmpJsonObj.mailLogBcc[ii];
                        }
                        sendMailFlg = true;
                    }
                    // office365の予定表からメール送信でログ取得
                    else if (postdataSendMeeting.toLowerCase() == TRIGGER_MAIL_OFFICE365_SENDTOALLANDSAVECOPY
                             || postdataSendCalendar.toLowerCase() == TRIGGER_MAIL_OFFICE365_SENDTOALLANDSAVECOPY
                             || postdataSendCalendar.toLowerCase() == TRIGGER_MAIL_OFFICE365_SENDTOCHANGEDANDSAVECOPY)
                    {
                        tmpJsonObj = {mailLogTo: new Array(), mailLogSubject: '', mailLogBody: ''};
                        getMailValueOffice365Schedule(jsonObj, tmpJsonObj);

                        // To
                        for (var ii = 0; ii < tmpJsonObj.mailLogTo.length; ii++)
                        {
                            if (mailTo != '')
                            {
                                mailTo += SEMI_COLON;
                            }
                            mailTo += tmpJsonObj.mailLogTo[ii];
                        }
                        sendMailFlg = true;
                    }

                    if (sendMailFlg)
                    {
                        // 本文の特殊文字を入力された文字に変換する
                        tmpJsonObj.mailLogBody = replaceSpecialChar(tmpJsonObj.mailLogBody);
                        
                        chrome.windows.getCurrent(
                            function(window)
                            {
                                activeWindowId = window.id;
                                chrome.tabs.query(
                                    {active: true}
                                    , function(result)
                                      {
                                          for (var i = 0; i < result.length; i++)
                                          {
                                              if (activeWindowId == result[i].windowId)
                                              {
                                                  chrome.tabs.sendMessage(
                                                      result[i].id
                                                      , {action: GET_UPFILENAME_FROM_OFFICE365, TABID: result[i].id}
                                                      , function(response)
                                                        {   
                                                            chrome.storage.local.get(
                                                                [SESSION_OFFICE365FROM, SESSION_OFFICE365UPFILENAME, SESSION_OFFICEONLINEFROM]
                                                                , function(value) 
                                                                  {
                                                                      // Fromの取得
                                                                      if (isIndexOf(details.url, TRIGGER_OFFICE365))
                                                                      {
                                                                          // Office365の場合、ヘッダ「x-owa-urlpostdata」から取得している。
                                                                          mailFrom = value[SESSION_OFFICE365FROM];
                                                                      }
                                                                      else
                                                                      {
                                                                          mailFrom = tmpJsonObj.mailFrom;
                                                                      }
                                                                      
                                                                      var upFileName = '';
                                                                      if (response != undefined)
                                                                      {
                                                                          // 添付ファイル名取得
                                                                          var index = response.indexOf(ASTERISK);
                                                                          upFileName = response.substring(0, index);
                                                                          if (upFileName)
                                                                          {
                                                                              upFileName = replaceSpecialChar(upFileName);
                                                                          }
                                                                          
                                                                          // From情報がない時にresponseから取得する
                                                                          if (!mailFrom)
                                                                          {
                                                                              mailFrom = response.substring(index + 1);
                                                                          }
                                                                      }
                                                                      
                                                                      // 別ウィンドウで表示したときの添付ファイル名が存在している場合、
                                                                      // 保持したデータを参照する
                                                                      var storageUpFileName = value[SESSION_OFFICE365UPFILENAME];
                                                                      if (storageUpFileName)
                                                                      {
                                                                          upFileName = replaceSpecialChar(storageUpFileName);
                                                                      }
                                                                      
                                                                      // From情報がない場合、保持したデータを参照する
                                                                      if (!mailFrom)
                                                                      {
                                                                          mailFrom = value[SESSION_OFFICEONLINEFROM];
                                                                      }
                                                                      
                                                                      // ログ情報格納
                                                                      var sendMailInfo = '';
                                                                      sendMailInfo = getWebMailInfo(mailFrom, mailTo, mailCc, mailBcc, 
                                                                          tmpJsonObj.mailLogSubject, upFileName, tmpJsonObj.mailLogBody);
                                                                      if (mailTo != '' || mailCc != '' || mailBcc != '') 
                                                                      {
                                                                          // 共有メモリ書き込み
                                                                          sendWebMailLog(sendMailInfo, details.url);
                                                                      }
                                                                  }
                                                            );
                                                        }
                                                  );
                                                  break;
                                              }
                                          }
                                      }
                                );
                            }
                        );
                        // 即座に取得した場合、操作実行前の添付ファイル情報が取得されるため、遅延取得する
                        sleep(1, function ()
                        {
                            // 添付ファイル情報を取得
                            setSessionAttachmentOffice365(false);
                        });
                    }
                    delete buff;
                }
            }
        }
    }
}

/*************************************************************/
/* Json形式の文字列から指定されたキーの値を取得する
/*************************************************************/
function getValueFromJson(jsonObj, keyName)
{
    var ii = 0;
    var len = 0;
    var result = '';
    for (var key in jsonObj)
       {
        if (key.toLowerCase() == keyName)
        {
            result = jsonObj[key];
            break;
        }

        if (jsonObj[key] instanceof Array || jsonObj[key] instanceof Object)
        {
            // パラメータが配列やオブジェクトの場合は、再帰処理で深堀する
            result = arguments.callee(jsonObj[key], keyName);
            if (result != '')
            {
                break;
            }
        }
    }
    return result;
}

/*************************************************************/
/* office365の送信メール内容取得
/*************************************************************/
function getMailValueOffice365(jsonObj, outputObj)
{
    // メール内容の解析
    function getMailInfoFromJson(response, prefix)
    {
        for (var key in response)
        {
            if (typeof response[key] == "object")
            {
                if (Array.isArray(response[key]))
                {
                    // 配列の場合は要素ごとに再帰呼び出し
                    response[key].forEach(function (item) 
                    {
                        getMailInfoFromJson(item, prefix + " " + key);
                    });
                }
                else 
                {
                    getMailInfoFromJson(response[key], prefix + " " + key);
                }
            }
            else
            {
                // To情報
                if ((prefix + " " + key).includes("ToRecipients EmailAddress"))
                {
                    outputObj.mailLogTo.push(response[key]);
                }
                // Cc情報
                else if ((prefix + " " + key).includes("CcRecipients EmailAddress"))
                {
                    outputObj.mailLogCc.push(response[key]);
                }
                // Bcc情報
                else if ((prefix + " " + key).includes("BccRecipients EmailAddress"))
                {
                    outputObj.mailLogBcc.push(response[key]);
                }
                // 件名情報
                else if ((prefix + " " + key).includes("Items Subject") ||
                         (prefix + " " + key).includes("ItemChanges Updates Item Subject"))
                {
                    outputObj.mailLogSubject = response[key];
                }
                // 本文情報
                else if ((prefix + " " + key).includes("Body Value") ||
                         (prefix + " " + key).includes("NewBodyContent Value"))
                {
                    outputObj.mailLogBody = response[key];
                }
                // From情報
                else if ((prefix + " " + key).includes("Mailbox EmailAddress"))
                {
                    outputObj.mailFrom = response[key];
                }
            }
        }
    }

    // 関数内に定義した関数で再帰呼び出しによるメール内容取得
    getMailInfoFromJson(jsonObj, "");
    return;
}

/*************************************************************/
/* office365の予定表の送信メール内容取得
/*************************************************************/
function getMailValueOffice365Schedule(jsonObj, outputObj)
{
    const REQUIREDATTENDEES = 'requiredattendees';
    const SUBJECT = 'subject';
    const VALUE = 'value';

    var ii = 0;
    var len = 0;
    for (var key in jsonObj)
       {
        if (key.toLowerCase() == REQUIREDATTENDEES)
        {
            len = jsonObj[key].length;
            for (ii = 0; ii < len; ii++)
            {
                outputObj.mailLogTo[outputObj.mailLogTo.length] = jsonObj[key][ii].Mailbox.EmailAddress;
            }
        }
        else if (key.toLowerCase() == SUBJECT)
        {
            outputObj.mailLogSubject = jsonObj[key];
        }
        else if (key.toLowerCase() == VALUE)
        {
            outputObj.mailLogBody = jsonObj[key];
        }

        if (jsonObj[key] instanceof Array || jsonObj[key] instanceof Object)
        {
            // パラメータが配列やオブジェクトの場合は、再帰処理で深堀する
            arguments.callee(jsonObj[key], outputObj);
        }
    }
    return;
}

/*************************************************************/
/* アップロードログ、Webメール送信ログ用ファンクション
/*************************************************************/
function webBeforeRequest(details)
{
    const POST = 'POST';
    var now = new Date();

    // POSTの場合にログ取得を行う
    if (details.method != POST)
    {
        return {};
    }

    // リクエストボディがnullの場合は、ログ取得しない
    if (details.requestBody == null)
    {
        return {};
    }

    var communicationUrl = decodeURIComponent(details.url);

    // 前回と同一URLの場合は処理しない
    if (communicationUrl == send_URL)
    {
        return {};
    }
    
    // アップロードログ:GoogleDrive(1ログ1ファイル)
    if (isIndexOf(communicationUrl, TRIGGER_UPLOAD_GOOGLEDRIVE))
    {
        getUploadLogGoogleDrive(details);
        return {};
    }

    // アップロードログ:Gmailで25MB超(1ログ1ファイル)
    if (isIndexOf(communicationUrl, TRIGGER_UPLOAD_GMAIL_ATTACH_LINK))
    {
        getUploadLogGoogleDrive(details);
        return {};
    }

    // アップロードログ:office365(メール)(1ログ1ファイル)
    if (isIndexOf(communicationUrl, TRIGGER_UPLOAD_OFFICE365_REFERENCE)
        || isIndexOf(communicationUrl, TRIGGER_UPLOAD_OFFICE365_ATTACHMENT))
    {
        getUploadLogOffice365(details);
        return {};
    }

    // アップロードログ:office365(Lightモード)(1ログ1ファイル)
    if (isIndexOf(communicationUrl, TRIGGER_UPLOAD_OFFICE365_LIGHT))
    {
        getUploadLogOffice365Light(details);
        return {};
    }

    // アップロードログ:OneDrive(Office365)(1ログ複数ファイル)
    if (isIndexOf(communicationUrl, TRIGGER_UPLOAD_ONEDRIVE_OFFICE365))
    {
        getUploadLogOneDriveOffice365(details);
        return {};
    }

    // アップロードログ:OneDrive(Office365)(1ログ複数ファイル)(容量の大きいファイルの場合)
    if (isIndexOf(communicationUrl, TRIGGER_UPLOAD_ONEDRIVE_OFFICE365_BIG))
    {
        getUploadLogOneDriveOffice365Big(details);
        return {};
    }

    // アップロードログ:OneDrive(Office365でUIが新しい場合)(1ログ1ファイル)
    if ((isIndexOf(communicationUrl, TRIGGER_UPLOAD_ONEDRIVE_OFFICE365_201511)
            || isIndexOf(communicationUrl, TRIGGER_UPLOAD_ONEDRIVE_OFFICE365_FOLDER_201511)
            || isIndexOf(communicationUrl, TRIGGER_UPLOAD_ONEDRIVE_OFFICE365_201704))
        && isIndexOf(communicationUrl, TRIGGER_UPLOAD_ONEDRIVE_OFFICE365_ADD_201511))
    {
        getUploadLogOneDriveOffice365_201511(details);
        return {};
    }
    
    // アップロードログ:OneDrive(1ログ1ファイル)
    if ((isIndexOf(communicationUrl, TRIGGER_UPLOAD_ONEDRIVE_OFFICE365_201807))
        && isIndexOf(communicationUrl, TRIGGER_UPLOAD_ONEDRIVE_OFFICE365_ADD_201807))
    {
        getUploadLogOneDriveOffice365_201807(details);
        return {};
    }

    // アップロードログ:Gmail、Outlook.com(1ログ1ファイル)
    if (isIndexOf(communicationUrl, TRIGGER_UPLOAD_GMAIL_INLINE)
        || isIndexOf(communicationUrl, TRIGGER_UPLOAD_GMAIL_INLINE_DD)
        || isIndexOf(communicationUrl, TRIGGER_UPLOAD_OUTLOOKCOM))
    {
        var isUploadLog = getUploadLogGoogle(details);
        if (isUploadLog)
        {
            return {};
        }
    }

    // Gmail「写真を挿入」からアップロードした際、
    // 「getUploadLogGoogle」でアップロードログが取得できない場合は、
    // GoogleDriveと同じ方法で取得(1ログ1ファイル)
    if (isIndexOf(communicationUrl, TRIGGER_UPLOAD_GMAIL_INLINE))
    {
        getUploadLogGoogleDrive(details);
        return {};
    }

    // アップロードログ:DropBox(1ログ1ファイル)
    if (isIndexOf(communicationUrl, TRIGGER_UPLOAD_DROPBOX_ENHANCE)
        || isIndexOf(communicationUrl, TRIGGER_UPLOAD_DROPBOX_REQUEST))
    {
        getUploadLogDropBox(details);
        return {};
    }

    // アップロードログ:簡易版Gmail(1ログ複数ファイル)
    if (isIndexOf(communicationUrl, TRIGGER_GMAIL_URL_SIMPLE)
        && (details.requestBody.formData[TRIGGER_MAIL_GMAIL_SIMPLE_SEND] != null
            || details.requestBody.formData[TRIGGER_UPLOAD_GMAIL_SIMPLE_SD] != null
            || details.requestBody.formData[TRIGGER_UPLOAD_GMAIL_SIMPLE_AMF] != null
            || details.requestBody.formData[TRIGGER_UPLOAD_GMAIL_SIMPLE_DONE] != null))
    {
        getUploadLogGmailSimple(details);
    }

    // Webメール送信ログ:office365のメール、office365のグループ会話でメール送信
    //                   Outlook.comでoffice365と同じサービス仕様になっているアカウントでのメール送信
    if (isIndexOf(communicationUrl, TRIGGER_MAIL_OFFICE365_UPDATE)
        || isIndexOf(communicationUrl, TRIGGER_MAIL_OFFICE365_CREATE)
        || isIndexOf(communicationUrl, TRIGGER_MAIL_OFFICE365_POSTGROUP))
    {
        getWebMailLogOffice365Request(details);
    }

    // Webメール送信ログ:Gmail
    if (isIndexOf(communicationUrl, TRIGGER_GMAIL_URL_SIMPLE)
        && (details.requestBody.formData[TRIGGER_MAIL_GMAIL_SIMPLE_SEND] != null))
    {
        // 簡易版Gmail
        getWebMailLogGmail(details, GMAIL_SIMPLE);
    }
    else if (isIndexOf(communicationUrl, TRIGGER_GMAIL_URL_SIMPLE_QUICK)
        && (details.requestBody.formData[TRIGGER_MAIL_GMAIL_SIMPLE_SEND] != null))
    {
        // 簡易版Gmailクイック返信
        getWebMailLogGmail(details, GMAIL_SIMPLE_QUICK);
    }
    else if (isIndexOf(communicationUrl, TRIGGER_MAIL_GMAIL_URL_HTML_FIRST)
          && isIndexOf(communicationUrl, TRIGGER_MAIL_GMAIL_URL_HTML_SECOND))
    {
        // 標準版Gmail
        getWebMailLogGmail(details, GMAIL_HTML);
    }

    // Webメール送信ログ:Outlook.com
    if (isIndexOf(communicationUrl, TRIGGER_MAIL_OUTLOOKCOM))
    {
        getWebmailLogOutlookcom(details);
        return {};
    }

    // ChatGPT書き込みログ用
    // chat.openai.com/backend-api/conversationあてにPOSTする通信が対象
    if (TRIGGER_CHATGPT_POST_URL.test(communicationUrl) || isIndexOf(communicationUrl, TRIGGER_CHATGPT_POST_URL_OLD) || isIndexOf(communicationUrl, TRIGGER_CHATGPT_POST_URL_FREE_OLD))
    {
        getChatGptPostMessage(details);
        return {};
    }
}

/*************************************************************/
/* DropBoxのアップロードログ
/*************************************************************/
function getUploadLogDropBox(details)
{
    const URL_PROPERTY_NAME = '&name=';

    var url = details.url;
    var uploadFileName = '';

    // アップロードファイル名を抽出
    uploadFileName = decodeURIComponent(getTargetStrSingle(URL_PROPERTY_NAME, AMPERSAND, url));

    // アップロードログ情報をセット
    setUploadLog(uploadFileName);
}

/*************************************************************/
/* Google、Outlook.comのアップロードログ
/*************************************************************/
function getUploadLogGoogle(details)
{
    var isUploadLog = false;
    const FILENAME_ST = 'filename\\\":\\\"';
    const FILENAME_ED = '\\\",';
    if (details.requestBody.raw)
    {
        for (var ii = 0; ii < details.requestBody.raw.length; ii++)
        {
            // ファイルパスが存在する場合は、アップロードログとみなす
            if (details.requestBody.raw[ii].file)
            {
                // アップロードログ情報をセット
                setUploadLog(details.requestBody.raw[ii].file);
                isUploadLog = true;
            }
        }
    }
    else
    {
        if (details.requestBody.formData)
        {
            var uploadFileName = JSON.stringify(details.requestBody.formData);
            var indexS = uploadFileName.indexOf(FILENAME_ST);
            uploadFileName = uploadFileName.substring(indexS + FILENAME_ST.length);
            var indexE = uploadFileName.indexOf(FILENAME_ED);
            uploadFileName = uploadFileName.substring(0, indexE);
            
            // ファイルパスが存在する場合は、アップロードログとみなす
            if (uploadFileName)
            {
                // アップロードログ情報をセット
                setUploadLog(uploadFileName);
                isUploadLog = true;
            }
        }
    }
    
    return isUploadLog;
}

/*************************************************************/
/* gmailのアップロードログ
/*************************************************************/
function getUploadLogGmail(headers)
{
    for (var i = 0; i < headers.length; i++)
    {
        var urlPostdata = '';
        if (headers[i].name.toLowerCase() == X_GOOGUPLOADFILENAME)
        {
            // デコード
            urlPostdata = decodeURIComponent(headers[i].value);

            // アップロードログ情報をセット
            setUploadLog(urlPostdata);
        }
    }
}

/*************************************************************/
/* GoogleDriveのアップロードログ
/*************************************************************/
function getUploadLogGoogleDrive(details)
{
    const PROPERTY_FILENAME = 'filename';

    var uploadFileName = '';
    if (details.requestBody.raw)
    {
        if (details.requestBody.raw.length > 0)
        {
            if (details.requestBody.raw[0].bytes)
            {
                var buff = new Uint8Array(details.requestBody.raw[0].bytes);
                var strOffice365Data = buff2str(buff);
                if (strOffice365Data != '')
                {
                    // 「%」を「%25」に置換し、decodeURI()でデコードできるようにする
                    strOffice365Data = replaceBeforeToAfter(strOffice365Data, PERCENT, ENCODEURI_PERCENT);
                    // デコード
                    var decodeStr = decodeURIComponent(strOffice365Data);
                    // Json形式に変換
                    var jsonObj = JSON.parse(decodeStr);

                    // アップロードファイル名を取得
                    uploadFileName = getValueFromJson(jsonObj.createSessionRequest, PROPERTY_FILENAME);

                    delete buff;
                    // アップロードログ情報をセット
                    setUploadLog(uploadFileName);
                }
            }
        }
    }
}

/*************************************************************/
/* office365(メール)のアップロードログ
/*************************************************************/
function getUploadLogOffice365(details)
{
    var strOffice365Data = '';
    var sumLength = 0;
    var pos = 0;

    if (details.requestBody.raw)
    {
        if (details.requestBody.raw.length > 0)
        {
            if (details.requestBody.raw[0].bytes)
            {
                // リクエストデータの全体容量取得
                for(var ii = 0; ii < details.requestBody.raw.length; ii++)
                {
                    sumLength += details.requestBody.raw[ii].bytes.byteLength;
                }
                // 取得した容量を元にメモリ確保
                var buff = new Uint8Array(sumLength);
                // リクエストデータを取得
                for(var ii = 0; ii < details.requestBody.raw.length; ii++)
                {
                    buff.set(new Uint8Array(details.requestBody.raw[ii].bytes), pos);
                    pos += details.requestBody.raw[ii].bytes.byteLength;
                }
                // バイト⇒文字列変換
                strOffice365Data = strOffice365Data + new TextDecoder('utf-8').decode((buff));

                if (strOffice365Data != '')
                {
                    // 「%」を「%25」に置換し、decodeURI()でデコードできるようにする
                    strOffice365Data = replaceBeforeToAfter(strOffice365Data, PERCENT, ENCODEURI_PERCENT);
                    // デコード
                    var decodeStr = decodeURIComponent(strOffice365Data);

                    // アップロードファイル名を取得
                    decodeStr = getUploadFileNameOffice365(decodeStr);

                    delete buff;
                    // アップロードログ情報をセット
                    setUploadLog(decodeStr);
                }
            }
        }
    }
}

/*************************************************************/
/* office365(Lightモード)のアップロードログ
/*************************************************************/
function getUploadLogOffice365Light(details)
{
    const ATTACH = 'attach';
    var uploadFileName = '';
    if (details.requestBody.formData[ATTACH])
    {
        // アップロードファイル名を取得
        uploadFileName = details.requestBody.formData[ATTACH][0];

        // アップロードログ情報をセット
        setUploadLog(uploadFileName);
    }
}

/*************************************************************/
/* OneDrive(Office365)のアップロードログ
/*************************************************************/
function getUploadLogOneDriveOffice365(details)
{
    var uploadFileName = '';
    var uploadFileCount = 0;
    for (key in details.requestBody.formData)
    {
        var value = details.requestBody.formData[key][0];
        if (value != '')
        {
            if (uploadFileName != '')
            {
                uploadFileName += TAB;
            }
            uploadFileName += value;
            uploadFileCount++;
        }
    }
    if (uploadFileCount > 0)
    {
        // アップロードログ情報をセット
        setUploadLog(uploadFileName);
    }
}

/*************************************************************/
/* OneDrive(Office365)のアップロードログ(容量の大きいファイルの場合)
/*************************************************************/
function getUploadLogOneDriveOffice365Big(details)
{
    const CUT_START_FILENAME = '&@file=';
    const CUT_START_FILENAME_201610 = '@a2=';
    const CUT_END_FILENAME = '&';
    const ESCAPE_SINGLE_QUOTATION_DOUBLE = '\'\'';
    const ESCAPE_SINGLE_QUOTATION = '\'';
    const UPLOAD_TYPE_CLASSIC = '/documents/';
    var uploadFileName = '';
    var requestUrl = '';

    if (details.requestBody.raw[0] && details.requestBody.raw[0]['file'])
    {
        uploadFileName = details.requestBody.raw[0]['file'];
    }
    // 2016/06/16時点で取得部分が変わっていたため追加。
    else
    {
        requestUrl = details.url;

        // ファイル名の格納場所が変わっていた為、取得場所「&@a2=」を追加(2016年10月発見)
        if (isIndexOf(requestUrl, CUT_START_FILENAME))
        {
            // 取得場所が「&@a2=」に変わった為、ここを通ることはないと思うが、予備の為、処理は残しておく
            uploadFileName = requestUrl.substring(requestUrl.lastIndexOf(CUT_START_FILENAME) + CUT_START_FILENAME.length);
        }
        else if (isIndexOf(requestUrl, CUT_START_FILENAME_201610))
        {
            uploadFileName = requestUrl.substring(requestUrl.lastIndexOf(CUT_START_FILENAME_201610) + CUT_START_FILENAME_201610.length);
        }

        if (isIndexOf(uploadFileName, CUT_END_FILENAME))
        {
            uploadFileName = uploadFileName.substring(0, uploadFileName.indexOf(CUT_END_FILENAME));
        }
        uploadFileName = decodeURIComponent(uploadFileName);
        // クラシックタイプの場合
        if (isIndexOf(uploadFileName, UPLOAD_TYPE_CLASSIC))
        {
            uploadFileName = uploadFileName.substring(uploadFileName.lastIndexOf('/'));
        }
        //シングルクォーテーション対策(ファイル名は''→'。最初と最後の'は取り除く)
        uploadFileName = replaceBeforeToAfter(uploadFileName, ESCAPE_SINGLE_QUOTATION_DOUBLE, ESCAPE_SINGLE_QUOTATION);
        uploadFileName = uploadFileName.substring(1, uploadFileName.length - 1);
    }

    // アップロードログ情報をセット
    setUploadLog(uploadFileName);
}

/*************************************************************/
/* OneDrive(Office365)のアップロードログ(UIが新しい場合)
/*************************************************************/
function getUploadLogOneDriveOffice365_201511(details)
{
    const DETAILS_URL_URL = '&@url=';
    const DETAILS_URL_DOC_201610 = '&@a2=';
    const DETAILS_URL_URL_END = '&';
    const ESCAPE_SINGLE_QUOTATION_DOUBLE = '\'\'';
    const ESCAPE_SINGLE_QUOTATION = '\'';
    var uploadFileName = '';
    var uploadFileCount = 0;
    var url = details.url;

    // ファイル名の格納場所が変わっていた為、取得場所「&@a2=」を追加(2016年10月発見)
    if (isIndexOf(url, DETAILS_URL_URL))
    {
        // 取得場所が「&@a2=」に変わった為、ここを通ることはないと思うが、予備の為、処理は残しておく
        uploadFileName = url.substring(url.indexOf(DETAILS_URL_URL) + DETAILS_URL_URL.length);
    }
    else if (isIndexOf(url, DETAILS_URL_DOC_201610))
    {
        uploadFileName = url.substring(url.indexOf(DETAILS_URL_DOC_201610) + DETAILS_URL_DOC_201610.length);
    }

    if (isIndexOf(uploadFileName, DETAILS_URL_URL_END))
    {
        uploadFileName = uploadFileName.substring(0, uploadFileName.indexOf(DETAILS_URL_URL_END));
    }
    uploadFileName = decodeURIComponent(uploadFileName);
    uploadFileName = uploadFileName.substring(1,uploadFileName.length - 1);

    // 「'」シングルクオーテーションが通信では「''」になるため、「'」に置換する
    uploadFileName = replaceBeforeToAfter(uploadFileName, ESCAPE_SINGLE_QUOTATION_DOUBLE, ESCAPE_SINGLE_QUOTATION);
    if (uploadFileName != '')
    {
        // アップロードログ情報をセット
        setUploadLog(uploadFileName);
    }
}

/*************************************************************/
/* OneDrive(Office365)のアップロードログ
/*************************************************************/
function getUploadLogOneDriveOffice365_201807(details)
{
    const DETAILS_URL_URL = 'Documents';
    const DETAILS_URL_URL_END = '&@a2=';
    const DELIMITER = '/';
    const ESCAPE_SINGLE_QUOTATION_DOUBLE = '\'\'';
    const ESCAPE_SINGLE_QUOTATION = '\'';
    var uploadFileName = '';
    var uploadFileCount = 0;
    var url = details.url;

    // ファイル名取得
    if (isIndexOf(url, DETAILS_URL_URL))
    {
        uploadFileName = url.substring(url.indexOf(DETAILS_URL_URL) + DETAILS_URL_URL.length);
    }

    if (isIndexOf(uploadFileName, DETAILS_URL_URL_END))
    {
        uploadFileName = uploadFileName.substring(0, uploadFileName.indexOf(DETAILS_URL_URL_END));
    }
    
    // URLデコード
    uploadFileName = decodeURIComponent(uploadFileName);
    
    // 前後の括りを削除
    uploadFileName = uploadFileName.substring(uploadFileName.lastIndexOf(DELIMITER) + DELIMITER.length);
    uploadFileName = uploadFileName.substring(0, uploadFileName.length - 1);

    // 「'」シングルクオーテーションが通信では「''」になるため、「'」に置換する
    uploadFileName = replaceBeforeToAfter(uploadFileName, ESCAPE_SINGLE_QUOTATION_DOUBLE, ESCAPE_SINGLE_QUOTATION);
    if (uploadFileName != '')
    {
        // アップロードログ情報をセット
        setUploadLog(uploadFileName);
    }
}

/*************************************************************/
/* OneDrive(Outlook.com)のアップロードログ
/*************************************************************/
function getUploadLogOneDriveOutlookCom(details)
{
    const BITS_PACKET_TYPE = 'bits-packet-type';
    const CLOSE_SESSION = 'close-session';
    const SLASH = '/';

    var headers = details.requestHeaders;
    var uploadFileName = '';
    var bitsPacketType = '';
    var indexS = 0;
    var isSetUploadLog = false;
    var tmpUploadFileName = '';

    for (var i = 0; i < headers.length; i++)
    {
        if (headers[i].name.toLowerCase() == BITS_PACKET_TYPE)
        {
            // デコード
            bitsPacketType = decodeURIComponent(headers[i].value);
            if (bitsPacketType.toLowerCase() == CLOSE_SESSION)
            {
                // アップロードファイル名取得
                indexS = details.url.lastIndexOf(SLASH);
                uploadFileName = decodeURIComponent(details.url.substring(indexS + 1));

                // アップロードログ情報をセット
                setUploadLog(uploadFileName);
                isSetUploadLog = true;
            }
        }
    }

    // 上記の処理でアップロードファイルが取得出来なかった場合、別の場所も確認する
    // ※アカウントによって、アップロードファイルの格納場所が異なる(2017年06月発見)
    if (!isSetUploadLog)
    {
        if ((details.method == 'POST') && isIndexOf(details.url, TRIGGER_UPLOAD_OUTLOOKCOM_201706))
        {
            indexE = getTargetLastIndex(details.url, TRIGGER_UPLOAD_OUTLOOKCOM_201706);
            tmpUploadFileName = details.url.substring(0, indexE);
            // アップロードファイル名取得
            indexS = tmpUploadFileName.lastIndexOf(SLASH);
            uploadFileName = decodeURIComponent(tmpUploadFileName.substring(indexS + 1));

            // アップロードログ情報をセット
            setUploadLog(uploadFileName);
            isSetUploadLog = true;
        }
    }

    // 上記の処理でアップロードファイルが取得出来なかった場合、別の場所も確認する
    // ※アカウントによって、アップロードファイルの格納場所が異なる(2017年07月発見)
    if (!isSetUploadLog)
    {
        if ((details.method == 'POST') && isIndexOf(details.url, TRIGGER_UPLOAD_OUTLOOKCOM_201707))
        {
            indexE = getTargetLastIndex(details.url, TRIGGER_UPLOAD_OUTLOOKCOM_201707);
            tmpUploadFileName = details.url.substring(0, indexE);
            // アップロードファイル名取得
            indexS = tmpUploadFileName.lastIndexOf(SLASH);
            uploadFileName = decodeURIComponent(tmpUploadFileName.substring(indexS + 1));

            // アップロードログ情報をセット
            setUploadLog(uploadFileName);
            isSetUploadLog = true;
        }
    }
}

/*************************************************************/
/* 簡易版Gmailのアップロードログ
/*************************************************************/
function getUploadLogGmailSimple(details)
{
    const FORM_DATA_KEY_FILE = 'file';

    var uploadFileName = '';
    var uploadFileCount = 0;
    for (key in details.requestBody.formData)
    {
        if (isIndexOf(key, FORM_DATA_KEY_FILE))
        {
            var value = details.requestBody.formData[key];
            if (value != '')
            {
                if (uploadFileName != '')
                {
                    uploadFileName += TAB;
                }
                uploadFileName += value;
                uploadFileCount++;
            }
        }
    }
    if (uploadFileCount > 0)
    {
        // アップロードログ情報をセット
        setUploadLog(uploadFileName);
    }
}

/*************************************************************/
/* Webメール送信ログ情報の整形
/*************************************************************/
function getWebMailInfo(from, to, cc, bcc, subject, attachment, body)
{
    var webMailInfo = '';
    webMailInfo = HEADER_MAIL_FROM + VERTICAL_LINE + from + VERTICAL_LINE
                + HEADER_MAIL_TO + VERTICAL_LINE + to + VERTICAL_LINE
                + HEADER_MAIL_CC + VERTICAL_LINE + cc + VERTICAL_LINE
                + HEADER_MAIL_BCC + VERTICAL_LINE + bcc + VERTICAL_LINE
                + HEADER_MAIL_SUBJECT + VERTICAL_LINE + subject + VERTICAL_LINE
                + HEADER_MAIL_ATTACHMENT + VERTICAL_LINE + attachment + VERTICAL_LINE
                + HEADER_MAIL_BODY + VERTICAL_LINE + body;
    // 改行文字をバーティカルラインに置換する
    webMailInfo = replaceBeforeToAfter(webMailInfo, ALL_LINE_BREAK, VERTICAL_LINE);
    // タブ文字を半角スペースに置換する
    webMailInfo = replaceBeforeToAfter(webMailInfo, TAB, HALF_SPACE);
    return webMailInfo;
}

/*************************************************************/
/* GmailのWebメール送信ログ(簡易版、標準版)
/*************************************************************/
function getWebMailLogGmail(details, gmailDispFlg)
{
    const FORMDATA_COMPOSEID = 'composeid';
    const FORMDATA_TO = 'to';
    const FORMDATA_CC = 'cc';
    const FORMDATA_BCC = 'bcc';
    const FORMDATA_SUBJECT = 'subject';
    const FORMDATA_BODY = 'body';
    
    const GMAIL_FROM_RANGE = /\[1\,\".*?[^\\]\"\,\".*?[^\\]\"\,.*?[^\\]\]\,/;
    const GMAIL_FROM_MID = '",';
    const GMAIL_MAILDATA_JUDGE = /^null\,/;
    const GMAIL_ADDRESS_LIST_RANGE = /\[\[1\,\".*?[^\\]\"\]\]\,/;
    const GMAIL_ADDRESS_ITEM = /\[1\,\".*?[^\\]\"\]/g;
    const GMAIL_ADDRESS_RANGE = /\[1\,\".*?[^\\]\"\]/;
    const GMAIL_ADDRESS_ST = '[1,"';
    const GMAIL_ADDRESS_ED = '"]';
    const GMAIL_ADDRESS_NAME = /\"\,\".*$/;
    const GMAIL_ADDRESS_NOTHING = 'null,';
    const GMAIL_SBJ_RANGE = /(\,\"\"\,|\,\".*?[^\\]\"\,)/;
    const GMAIL_CNT_RANGE = /(\,\"\"\,|\,\".*?[^\\]\"\]\]\,)/;
    
    const GMAIL_ATT_LIST_PREV = /\"\^f_bt\"[^\]]*\]\,/;
    const GMAIL_ATT_ITEM = /\[\".*?\"\,\".*?[^\\]\"\,.*?\,\[.*?\]\,.*?\]/g;
    const GMAIL_GET_VALUE_RANGE = /\,\".*?[^\\]\"\,/;
    const GMAIL_GET_VALUE_ST = ',"';
    const GMAIL_GET_VALUE_ED = '",';
    
    const GMAIL_DRIVE_ATT = 'gmail_chip gmail_drive_chip';
    const GMAIL_DRIVE_ATT_SUB = '<span';
    const GMAIL_DRIVE_ATT_ST = '\\">';
    const GMAIL_DRIVE_ATT_ED = '</span>';
    const GMAIL_TRIGGER_HTML = '"^f_bt"';
    const GMAIL_SENDDATA_ST = /\[\[\"msg-a:r[-0-9]+\"\,/;

    var sendMailInfo = '';
    var mailFrom = '';
    var upFileName = '';
    var gDriveUpFileName = '';
    var composeId = '';
    var mailTo = '';
    var mailCc = '';
    var mailBcc = '';
    var mailSubject = '';
    var mailBody = '';
    var index = 0;
    var strGmailData = '';
    var tmpGmailSendData = '';
    var indexS = 0;
    var indexE = 0;

    // クイック返信の場合
    if (gmailDispFlg == GMAIL_SIMPLE_QUICK)
    {
        // コンテンツスクリプトでHTMLタグからFrom（送信者）、To(宛先)を取得する
        chrome.tabs.sendMessage(
            details.tabId
            , {action: GET_FROM_TO_GMAIL_QUICK}
            , function(response)
              {
                  index = response.indexOf(COMMA);
                  // From取得
                  mailFrom = response.substring(0, index);
                  // To取得
                  mailTo = response.substring(index + 1);
                  mailTo = replaceBeforeToAfter(mailTo, COMMA, SEMI_COLON);
                  // 本文取得
                  mailBody = details.requestBody.formData[FORMDATA_BODY];
                  // ログ情報格納
                  sendMailInfo = getWebMailInfo(mailFrom, mailTo, mailCc, mailBcc, mailSubject, upFileName, mailBody);
                  // 共有メモリ書き込み
                  if (mailTo != '' || mailCc != '' || mailBcc != '') {
                      sendWebMailLog(sendMailInfo, details.url);
                  }
              }
        );
        return {};
    }

    // 簡易版、HTML版
    // フォームデータから情報を取得する場合
    if (details.requestBody.formData) {
        if (details.requestBody.formData[FORMDATA_COMPOSEID])
        {
            composeId = details.requestBody.formData[FORMDATA_COMPOSEID];
        }
        var tmpMailTo = new Array();
        var tmpMailCc = new Array();
        var tmpMailBcc = new Array();
        
        tmpMailTo = details.requestBody.formData[FORMDATA_TO];
        for (var i = 0; i < tmpMailTo.length; i ++)
        {
            if (tmpMailTo[i] != '')
            {
                if (mailTo != '')
                {
                    mailTo = mailTo + COMMA;
                }
                mailTo = mailTo + tmpMailTo[i];
            }
        }
        
        tmpMailCc = details.requestBody.formData[FORMDATA_CC];
        for (var i = 0; i < tmpMailCc.length; i ++)
        {
            if (tmpMailCc[i] != '')
            {
                if (mailCc != '')
                {
                    mailCc = mailCc + COMMA;
                }
                mailCc = mailCc + tmpMailCc[i];
            }
        }
        
        tmpMailBcc = details.requestBody.formData[FORMDATA_BCC];
        for (var i = 0; i < tmpMailBcc.length; i ++)
        {
            if (tmpMailBcc[i] != '')
            {
                if (mailBcc != '')
                {
                    mailBcc = mailBcc + COMMA;
                }
                mailBcc = mailBcc + tmpMailBcc[i];
            }
        }
        
        mailSubject = details.requestBody.formData[FORMDATA_SUBJECT][0];
        mailBody = details.requestBody.formData[FORMDATA_BODY][0];
    }
    // バイナリデータから情報を取得する場合
    else
    {
        if (details.requestBody.raw && details.requestBody.raw.length > 0)
        {
            if (details.requestBody.raw[0].bytes)
            {
                var buff = new Uint8Array(details.requestBody.raw[0].bytes);
                strGmailData = new TextDecoder('utf-8').decode((buff));
            }
        }

        // ログを取得するか判定する
        // 「"^f_bt"」を含み、取得するメール情報が存在しているときにログ取得する
        if (!(isIndexOf(strGmailData, GMAIL_TRIGGER_HTML)))
        {
            return {};
        }
        var gmailDataArray = strGmailData.match(GMAIL_SENDDATA_ST);
        if (gmailDataArray == null)
        {
            return {};
        }
        
        // メール情報が格納されている部分を取得する
        indexS = strGmailData.search(GMAIL_SENDDATA_ST);
        tmpGmailSendData = strGmailData.substring(indexS + gmailDataArray[0].length);
        
        // From取得
        var tmpMailFrom = sepalateTargetFromSendData(GMAIL_FROM_RANGE, tmpGmailSendData);
        tmpGmailSendData = tmpMailFrom.sendDataStr;
        var mailFromIndex = tmpMailFrom.targetStr.indexOf(GMAIL_FROM_MID);
        mailFrom = tmpMailFrom.targetStr.substring(4, mailFromIndex);
        
        // to取得
        if(tmpGmailSendData.search(GMAIL_MAILDATA_JUDGE) < 0)
        {
            var tmpMailTo = sepalateTargetFromSendData(GMAIL_ADDRESS_LIST_RANGE, tmpGmailSendData);
            tmpGmailSendData = tmpMailTo.sendDataStr;
            mailTo = getMailDataStr(GMAIL_ADDRESS_ITEM, GMAIL_ADDRESS_RANGE, 
                                    GMAIL_ADDRESS_ST, GMAIL_ADDRESS_ED, tmpMailTo.targetStr, GMAIL_ADDRESS_NAME);
        }
        else
        {
            tmpGmailSendData = tmpGmailSendData.substring(GMAIL_ADDRESS_NOTHING.length);
        }
        
        // cc取得
        if(tmpGmailSendData.search(GMAIL_MAILDATA_JUDGE) < 0)
        {
            var tmpMailCc = sepalateTargetFromSendData(GMAIL_ADDRESS_LIST_RANGE, tmpGmailSendData);
            tmpGmailSendData = tmpMailCc.sendDataStr;
            mailCc = getMailDataStr(GMAIL_ADDRESS_ITEM, GMAIL_ADDRESS_RANGE, 
                                    GMAIL_ADDRESS_ST, GMAIL_ADDRESS_ED, tmpMailCc.targetStr, GMAIL_ADDRESS_NAME);
        }
        else
        {
            tmpGmailSendData = tmpGmailSendData.substring(GMAIL_ADDRESS_NOTHING.length);
        }
        
        // bcc取得
        if(tmpGmailSendData.search(GMAIL_MAILDATA_JUDGE) < 0)
        {
            var tmpMailBcc = sepalateTargetFromSendData(GMAIL_ADDRESS_LIST_RANGE, tmpGmailSendData);
            tmpGmailSendData = tmpMailBcc.sendDataStr;
            mailBcc = getMailDataStr(GMAIL_ADDRESS_ITEM, GMAIL_ADDRESS_RANGE, 
                                     GMAIL_ADDRESS_ST, GMAIL_ADDRESS_ED, tmpMailBcc.targetStr, GMAIL_ADDRESS_NAME);
        }
        else
        {
            tmpGmailSendData = tmpGmailSendData.substring(GMAIL_ADDRESS_NOTHING.length);
        }
        
        // 件名取得
        var tmpMailSubject = sepalateTargetFromSendData(GMAIL_SBJ_RANGE, tmpGmailSendData);
        tmpGmailSendData = tmpMailSubject.sendDataStr;
        mailSubject = tmpMailSubject.targetStr.substring(2, tmpMailSubject.targetStr.length - 2);
        mailSubject = replaceEscape(mailSubject);
        
        // 本文取得
        var tmpMailBody = sepalateTargetFromSendData(GMAIL_CNT_RANGE, tmpGmailSendData);
        tmpGmailSendData = tmpMailBody.sendDataStr;
        mailBody = tmpMailBody.targetStr.substring(2, tmpMailBody.targetStr.length - 4);
        
        // 添付ファイル名取得
        var tmpUpFileName = sepalateTargetFromSendData(GMAIL_ATT_LIST_PREV, tmpGmailSendData);
        tmpGmailSendData = tmpUpFileName.sendDataStr;
        if (tmpGmailSendData != '')
        {
            if(tmpGmailSendData.search(GMAIL_MAILDATA_JUDGE) < 0)
            {
                upFileName = getMailDataStr(GMAIL_ATT_ITEM, GMAIL_GET_VALUE_RANGE, 
                                            GMAIL_GET_VALUE_ST, GMAIL_GET_VALUE_ED, tmpGmailSendData);
            }
        }

        // GoogleDriveから添付されたファイルは本文内から抽出する
        var tmpDriveUpFileName = '';
        var searchFileNameStr = '';

        // 「\">」～「</span>」の間にある添付ファイル名が取得できなくなるため、
        // 添付ファイル名の探索用の文字列を保持した後に本文の特殊文字を置換する
        searchFileNameStr = mailBody;
        mailBody = replaceSpecialCharGmail(mailBody);

        indexS = searchFileNameStr.indexOf(GMAIL_DRIVE_ATT);
        // 抽出開始文字・終了文字がどちらも存在しなければループ終了
        while ((indexS > -1) && (indexE > -1))
        {
            // ファイル格納位置のキーとなる「gmail_chip gmail_drive_chip」の文字列～最終文字まで取得
            searchFileNameStr = searchFileNameStr.substring(indexS);

            // さらにファイル格納位置のキーとなる「<span」の文字列～最終文字まで取得
            indexS = searchFileNameStr.indexOf(GMAIL_DRIVE_ATT_SUB);
            searchFileNameStr = searchFileNameStr.substring(indexS + GMAIL_DRIVE_ATT_SUB.length);

            // ファイル名が格納されている「\">」～「</span>」の間を取得
            indexS = searchFileNameStr.indexOf(GMAIL_DRIVE_ATT_ST);
            indexE = searchFileNameStr.indexOf(GMAIL_DRIVE_ATT_ED);
            tmpDriveUpFileName = searchFileNameStr.substring(indexS + GMAIL_DRIVE_ATT_ST.length, indexE);

            // GoogleDriveからの添付ファイルは特殊文字が変換された状態で取得される為、元に戻す
            tmpDriveUpFileName = replaceSpecialChar(tmpDriveUpFileName);

            // ファイル名を取得した部分は不要なのでカット
            searchFileNameStr = searchFileNameStr.substring(indexE + GMAIL_DRIVE_ATT_ED.length);

            // ファイル名を連結
            if (tmpDriveUpFileName != '')
            {
                if (gDriveUpFileName != '')
                {
                    gDriveUpFileName += SEMI_COLON + tmpDriveUpFileName;
                }
                else
                {
                    gDriveUpFileName += tmpDriveUpFileName;
                }
            }
            // ファイル格納位置となる「gmail_chip gmail_drive_chip」の位置を取得
            indexS = searchFileNameStr.indexOf(GMAIL_DRIVE_ATT);
        }

        // GoogleDrive経由以外のファイルのみ添付されていた場合
        if ((upFileName != '') && (gDriveUpFileName == ''))
        {
            upFileName = upFileName;
        }
        // GoogleDrive経由のファイルのみ添付されていた場合
        else if ((upFileName == '') && (gDriveUpFileName != ''))
        {
            upFileName = gDriveUpFileName;
        }
        // 通常・GoogleDrive経由のファイル共に添付されていた場合
        else if ((upFileName != '') && (gDriveUpFileName != ''))
        {
            upFileName += SEMI_COLON + gDriveUpFileName;
        }
    }
    // カンマはセミコロンに置換する
    mailTo = replaceBeforeToAfter(mailTo, COMMA, SEMI_COLON);
    mailCc = replaceBeforeToAfter(mailCc, COMMA, SEMI_COLON);
    mailBcc = replaceBeforeToAfter(mailBcc, COMMA, SEMI_COLON);

    if (gmailDispFlg != GMAIL_SIMPLE)
    {
        // 宛先が不十分の場合はメール送信とみなさない。
        if (mailTo != '' || mailCc != '' || mailBcc != '')
        {
            // ログ情報格納
            sendMailInfo = getWebMailInfo(mailFrom, mailTo, mailCc, mailBcc, mailSubject, upFileName, mailBody);
            // 共有メモリ書き込み
            sendWebMailLog(sendMailInfo, details.url);

            return {};
        }
    }

    // コンテンツスクリプトでHTMLタグからアップロードファイル名を取得する
    chrome.tabs.sendMessage(
        details.tabId
        , {action: GET_UPFILENAME_GMAIL, dispFlg: gmailDispFlg, composeId: composeId}
        , function(response)
         {
             upFileName = response;

             if (gmailDispFlg == GMAIL_SIMPLE)
             {
                 // コンテンツスクリプトでHTMLタグからFrom（送信者）を取得する
                 chrome.tabs.sendMessage(
                     details.tabId
                     , {action: GET_FROMADDRESS_GMAIL}
                     , function(responseFrom)
                      {
                          mailFrom = responseFrom;
                          // ログ情報格納
                          sendMailInfo = getWebMailInfo(mailFrom, mailTo, mailCc, mailBcc, mailSubject, upFileName, mailBody);
                          // 共有メモリ書き込み
                          if (mailTo != '' || mailCc != '' || mailBcc != '') {
                              sendWebMailLog(sendMailInfo, details.url);
                          }
                      }
                 );
             }
         }
    );
}

/*************************************************************/
/* 文字列切り出し処理
/* 対象の文字列で切り出された文字列と切り出された後の文字列を返す
/*************************************************************/
function sepalateTargetFromSendData(sepalateStr, sendDataStr)
{
    var targetStr = '';
    
    if (sendDataStr == '')
    {
        return { targetStr, sendDataStr };
    }
    
    // 正規表現で対象の文字列を切り出す
    var sepalateArray = sendDataStr.match(sepalateStr);
    var sepalateIndex = sendDataStr.search(sepalateStr);
    
    if (sepalateArray == null)
    {
        return { targetStr, sendDataStr };
    }
    
    targetStr = sepalateArray[0];
    sendDataStr = sendDataStr.substring(sepalateIndex + targetStr.length);
    
    return { targetStr, sendDataStr };
}

/*************************************************************/
/* 文字列切り出し処理
/* 対象の文字列で挟まれた部分を切り出す(複数)
/*************************************************************/
function getMailDataStr(itemStr, sepalateStr, startStr, endStr, sendDataStr, deleteStr = '')
{
    var mailData = '';
    
    // 正規表現を用いてリストから1項目ずつデータを抜き出す
    var mailDataArray = sendDataStr.match(itemStr);
    if (mailDataArray == null)
    {
        return mailData;
    }
    
    // 抜き出したデータを連結し、必要なログ情報を取得する
    for (var i = 0; i < mailDataArray.length; i ++)
    {
        // 抜き出したデータからログに必要なデータだけを抽出する
        var tmpMailData = sepalateTargetFromSendData(sepalateStr, mailDataArray[i]).targetStr;
        tmpMailData = tmpMailData.substring(startStr.length, tmpMailData.length - endStr.length);
        
        if (deleteStr != '')
        {
            tmpMailData = tmpMailData.replace(deleteStr, '');
        }
        
        if (tmpMailData != '')
        {
            if (mailData != '')
            {
                mailData += SEMI_COLON + tmpMailData;
            }
            else
            {
                mailData += tmpMailData;
            }
        }
    }
    
    mailData = replaceEscape(mailData);
    return mailData;
}

/*************************************************************/
/* 標準HTML形式のGmailの本文に関する特殊文字とエスケープ文字の置換
/*************************************************************/
function replaceSpecialCharGmail(value)
{
    var targetStr = value;
    targetStr = targetStr.replace(/(&nbsp;)/g, ' ');
    targetStr = targetStr.replace(/(&lt;)/g, '<');
    targetStr = targetStr.replace(/(&gt;)/g, '>');
    targetStr = targetStr.replace(/(&amp;)/g, '&');
    targetStr = targetStr.replace(/(&#39;)/g, "'");
    targetStr = targetStr.replace(/(&quot;)/g, '"');
    targetStr = replaceEscape(targetStr);
    return targetStr;
}

/*************************************************************/
/* Outlook.comのWebメール送信ログ
/*************************************************************/
function getWebmailLogOutlookcom(details)
{
    const MAIL_INFO_START_STRING = '&d=';
    const ATTACH_FILE_START_STRING = 'u\\';
    const SEPARATE_STRING = '",';

    if (details.requestBody.raw && details.requestBody.raw.length > 0)
    {
        if (details.requestBody.raw[0].bytes)
        {
            var buff = new Uint8Array(details.requestBody.raw[0].bytes);
            var strOutlookcomData = buff2str(buff);
            if (strOutlookcomData != '')
            {
                var decodeStr = decodeURIComponent(strOutlookcomData);
                delete buff;

                // メール情報を取得する
                var indexS = decodeStr.indexOf(MAIL_INFO_START_STRING);
                decodeStr = decodeStr.substring(indexS + 3);
                var mailArray = new Array();
                for (var i = 0; i < 7; i++)
                {
                    if (i == 4)
                    {
                        indexS = decodeStr.indexOf(COMMA);
                    }
                    else
                    {
                        indexS = decodeStr.indexOf(SEPARATE_STRING);
                    }
                    mailArray[i] = decodeStr.substring(0, indexS);
                    mailArray[i] = replaceEscape(mailArray[i]);

                    // アドレスのみ置換する
                    if ((0 <= i) && (i <= 3))
                    {
                        mailArray[i] = mailArray[i].replace(/(\\\")/g, '\"');
                    }
                    // 本文の場合に特殊文字を入力された文字に変換する
                    if (i == 6)
                    {
                        mailArray[i] = replaceSpecialChar(mailArray[i]);
                    }
                    decodeStr = decodeStr.substring(indexS + SEPARATE_STRING.length);
                }

                // Toの取得
                var mailTo = mailArray[0].substring(1);

                // Fromの取得
                var mailFrom = mailArray[1].substring(1, mailArray[1].length);

                // Ccの取得
                var mailCc = mailArray[2].substring(1);

                // Bccの取得
                var mailBcc = mailArray[3].substring(1);

                // 件名の取得
                var mailSubject = mailArray[5].substring(0, mailArray[5].length);

                // 本文の取得
                var mailBody = mailArray[6].substring(1, mailArray[6].length);

                // 添付ファイル名の取得
                var upFileName = '';
                indexS = decodeStr.indexOf(ATTACH_FILE_START_STRING);
                while (indexS > -1)
                {
                    indexS = decodeStr.indexOf(VERTICAL_LINE, indexS + 3);
                    indexE = decodeStr.indexOf(VERTICAL_LINE, indexS + 1);
                    if (upFileName != '')
                    {
                        upFileName += SEMI_COLON;
                    }
                    upFileName += replaceEscape(decodeStr.substring(indexS + 37, indexE - 1));
                    decodeStr = decodeStr.substring(indexE + 1);
                    indexS = decodeStr.indexOf(ATTACH_FILE_START_STRING);
                }

                // ログ情報格納
                var sendMailInfo = '';
                sendMailInfo = getWebMailInfo(mailFrom, mailTo, mailCc, mailBcc, mailSubject, upFileName, mailBody);
                // 共有メモリ書き込み
                sendWebMailLog(sendMailInfo, details.url);
            }
        }
    }
}

/*************************************************************/
/* office365でFromをセッションで保持
/*************************************************************/
function setSessionFromOffice365(details)
{
    const FROM_ST = '"RawIdentity":"';
    const FROM_ED = '"}';

    var headers = details.requestHeaders;
    
    // Fromをセッションで保持する
    for (var i = 0; i < headers.length; i++)
    {
        if (headers[i].name.toLowerCase() == X_OWA_URLPOSTDATA)
        {
            var mailFrom = decodeURIComponent(headers[i].value);
            mailFrom = getTargetStrSingle(FROM_ST, FROM_ED, mailFrom);
            chrome.storage.local.set({[SESSION_OFFICE365FROM]: mailFrom});
        }
    }
}

/*************************************************************/
/* office365で添付ファイル名をセッションで保持
/*************************************************************/
function setSessionAttachmentOffice365(fileDeleted)
{
    // 添付ファイル名をセッションで保持する
    chrome.windows.getCurrent(
        function(window)
        {
            activeWindowId = window.id;
            chrome.tabs.query(
                {active: true}
                , function(result)
                  {
                      for (var i = 0; i < result.length; i++)
                      {
                          if (activeWindowId == result[i].windowId)
                          {
                              chrome.tabs.sendMessage(
                                  result[i].id
                                  , {action: SET_UPFILENAME_OFFICE365, flag: fileDeleted, tabid: result[i].id}
                                  , function(response)
                                    {
                                        if (response != undefined)
                                        {
                                            chrome.storage.local.set({[SESSION_OFFICE365UPFILENAME]: response});
                                        }
                                    }
                              );
                          }
                      }
                  }
            );
        }
    );
}

/*************************************************************/
/* OfficeOnlineでFromをセッションで保持
/*************************************************************/
function setSessionFromOfficeOnline(details)
{
    // From情報をセッションで保持する
    chrome.windows.getCurrent(
        function(window)
        {
            activeWindowId = window.id;
            chrome.tabs.query(
                {active: true}
                , function(result)
                  {
                      for (var i = 0; i < result.length; i++)
                      {
                          if (activeWindowId == result[i].windowId)
                          {
                              chrome.tabs.sendMessage(
                                  result[i].id
                                  , {action: SET_FROM_OFFICEONLINE}
                                  , function(response)
                                    {
                                        // responseにデータが存在するときにFrom情報を更新する
                                        if (response)
                                        {
                                            chrome.storage.local.set({[SESSION_OFFICEONLINEFROM]: response});
                                        }
                                    }
                              );
                          }
                      }
                  }
            );
        }
    );
}

/*************************************************************/
/* OneDrive(Outlook.com)のアップロードログ、
/* office365のWebメール送信ログ、
/* office365の10KB未満のアップロードログ、
/* 予定表、タスクのアップロードログ用ファンクション
/*************************************************************/
function webBeforeSendHeaders(details)
{
    if (details.tabId < 0)
    {
        return {};
    }

    var communicationUrl = decodeURIComponent(details.url);
    var headers = details.requestHeaders;
    var now = new Date();

    // アップロードログ:OneDrive(Outlook.com)(ファイル、フォルダ)
    if (isIndexOf(communicationUrl, TRIGGER_UPLOAD_OUTLOOKCOM_LIVEFOLDERS)
        || isIndexOf(communicationUrl, TRIGGER_UPLOAD_OUTLOOKCOM_ITEMS))
    {
        getUploadLogOneDriveOutlookCom(details);
    }

    // アップロードログ:office365の10KB未満のアップロード、予定表、タスクのアップロード
    if (isIndexOf(communicationUrl, TRIGGER_UPLOAD_OFFICE365_REFERENCE)
        || isIndexOf(communicationUrl, TRIGGER_UPLOAD_OFFICE365_ATTACHMENT))
    {
        getUploadLog365Calendar(headers);
    }

    // Webメール送信ログ:office365のメール、office365のグループ会話でメール送信
    if (isIndexOf(communicationUrl, TRIGGER_MAIL_OFFICE365_UPDATE)
        || isIndexOf(communicationUrl, TRIGGER_MAIL_OFFICE365_CREATE)
        || isIndexOf(communicationUrl, TRIGGER_MAIL_OFFICE365_POSTGROUP))
    {
        getWebMailLogOffice365(headers, communicationUrl, details.tabId);
    }

    // 1.office365のメール作成時にFrom、添付ファイル名を保持しておく
    //   定期的に走る通信の中で保持する
    //   メール送信時のファンクションよりも後にしておくことで送信前にクリアされることを防ぐ
    // 2.メール送信後、添付ファイル名を取得するまでに取得されてしまう不要な通信を取り除く
    if (isIndexOf(communicationUrl, TRIGGER_OUTLOOK)
        && !isIndexOf(communicationUrl, TRIGGER_OUTLOOK_REMOVE_URL))
    {

        if (isIndexOf(communicationUrl, TRIGGER_SAVE_FROM_OFFICE365))
        {
            // Fromを取得
            setSessionFromOffice365(details);
        }

        // 即座に取得した場合、操作実行前の添付ファイル情報が取得されるため、遅延取得する
        sleep(1, function ()
        {
            if (isIndexOf(communicationUrl, TRIGGER_OFFICE365_DELETE)){
                setSessionAttachmentOffice365(true);
            }
            else{
                // 添付ファイル情報を取得
                setSessionAttachmentOffice365(false);
            }
        });
    }

    // 標準版Gmail 添付ファイルのアップロード
    if (isIndexOf(communicationUrl, TRIGGER_UPLOAD_GMAIL_ATTACH))
    {
        getUploadLogGmail(headers);
    }

    // OfficeOnlineでメール作成時にFrom情報を保持しておく
    if (isIndexOf(communicationUrl, TRIGGER_OFFICEONLINE))
    {
        setSessionFromOfficeOnline(details);
    }
}

/*************************************************************/
/* ダウンロードログ用ファンクション
/*************************************************************/
function lspWaoGcDownloadLog(downloadItem)
{
    const STATE_INPROGRESS = 'in_progress';
    var activeWindowId = '';
    var lastAccessTabTitle = '';
    var downloadPath = '';
    var activeTitle = '';
    var activeUrl = '';
    var downloadInfo = '';

    // ダウンロード状態が「in_progress」以外は、ログとしない
    if (downloadItem.state != STATE_INPROGRESS) {
        return {};
    }

    // 現在のタブ情報取得
    chrome.windows.getCurrent(
        function(window)
        {
            activeWindowId = window.id;
            var getTitle = SESSION_LAST_ACCESS_TAB_TITLE + UNDER_SCORE + activeWindowId;
            chrome.storage.local.get(
                getTitle
                , function(value)
                  {
                      lastAccessTabTitle = value[getTitle];
                      activeUrl = cutMaxLengthStr(downloadItem.url, URL_LENGTH);

                      // セッション情報が存在しない場合は、画面からタイトル、URLを取得
                      if (lastAccessTabTitle == null)
                      {
                          chrome.tabs.query(
                              {active: true}
                              , function(result)
                                {
                                    for (var i = 0; i < result.length; i++)
                                    {
                                        if (activeWindowId == result[i].windowId)
                                        {
                                            activeTitle = cutMaxLengthStr(result[i].title, TITLE_LENGTH);

                                            downloadPath = cutMaxLengthStr(getDownloadUrl(downloadItem), DLFILE_URL_LENGTH);
                                            downloadInfo = activeUrl.length + TAB + activeUrl + TAB
                                                         + activeTitle.length + TAB + activeTitle + TAB
                                                         + downloadPath.length + TAB + downloadPath;

                                            createLog(EXTENSION_VER + TAB + SHAREDMEM_DOWNLOAD + TAB + downloadInfo);
                                        }
                                    }
                                }
                          );
                      }
                      // セッション情報が存在する場合
                      else
                      {
                          downloadPath = cutMaxLengthStr(getDownloadUrl(downloadItem), DLFILE_URL_LENGTH);
                          downloadInfo = activeUrl.length + TAB + activeUrl + TAB
                                       + lastAccessTabTitle.length + TAB + lastAccessTabTitle + TAB
                                       + downloadPath.length + TAB + downloadPath;

                          createLog(EXTENSION_VER + TAB + SHAREDMEM_DOWNLOAD + TAB + downloadInfo);
                      }
                  }
            );
        }
    );
}

/*************************************************************/
/* ダウンロードURL取得処理
/*************************************************************/
function getDownloadUrl(downloadItem)
{
    var downloadUrl = '';

    // 「about:blank」の場合、「finalUrl」プロパティをチェック
    if (downloadItem.finalUrl == undefined)
    {
        // 「finalUrl」プロパティの値がundefinedの場合、取得出来ない為、urlの値を設定
        // ※「finalUrl」プロパティは、Chromeのバージョン54未満は存在しない為、その対策
        downloadUrl = downloadItem.url;
    }
    else
    {
        // 「finalUrl」プロパティの値が取得出来れば、そのまま設定
        downloadUrl = downloadItem.finalUrl;
    }

    return downloadUrl;
}

/*************************************************************/
/* 閲覧ログ用ファンクション
/*************************************************************/
function lspWaoGcBrowsingLog()
{
    var hasFocus = false;
    var activeWindowId = '';
    var lastAccessTabTitle = '';
    var activeTitle = '';
    var activeUrl = '';
    var tabBrowseInfo = '';

    // Chromeウィンドウの情報取得
    chrome.windows.getCurrent(
        function(window)
        {
            if (window)
            {
                hasFocus = window.focused;
                activeWindowId = window.id;
            }

            // アクティブになっている場合のみ、閲覧ログ取得処理を行う
            if (hasFocus)
            {
                // 現在のタブ情報取得
                chrome.tabs.query(
                    {active: true}
                    , function(result)
                      {
                          for (var i = 0; i < result.length; i++)
                          {
                              if (activeWindowId == result[i].windowId)
                              {
                                  activeTitle = cutMaxLengthStr(result[i].title, TITLE_LENGTH);
                                  activeUrl = cutMaxLengthStr(result[i].url, URL_LENGTH);
                              }
                          }

                          // タイトルが空白となるタイミングがある為、制御する
                          if (activeTitle != '')
                          {
                              var getTitle = SESSION_LAST_ACCESS_TAB_TITLE + UNDER_SCORE + activeWindowId;
                              chrome.storage.local.get(
                                  getTitle
                                  , function(value)
                                    {
                                        // 最後にアクセスしたタブのタイトル取得
                                        lastAccessTabTitle = value[getTitle];
                                        
                                        // 下記の条件のいずれかを満たす場合、閲覧ログを出力する
                                        // [条件1]:フォーカスアウト⇒フォーカスした場合
                                        // [条件2]:タイトルが切り替わった場合
                                        if ((!isFocusedWindow) || (lastAccessTabTitle != activeTitle))
                                        {
                                            // 閲覧ログ取得
                                            tabBrowseInfo = activeUrl.length + TAB + activeUrl + TAB
                                                          + activeTitle.length + TAB + activeTitle;

                                            // 閲覧のタイトル、URLを保持しておく
                                            var setTitle = SESSION_LAST_ACCESS_TAB_TITLE + UNDER_SCORE + activeWindowId;
                                            chrome.storage.local.set({[setTitle]: activeTitle});
                                            isFocusedWindow = true;
                                            
                                            // 閉じたブラウザの閲覧データを削除するため、WindowsIDを保持しておく
                                            chrome.storage.local.get(
                                                SESSION_STORAGEKEYLIST
                                                , function(value)
                                                  {
                                                      var keyDataStr = value[SESSION_STORAGEKEYLIST];
                                                      if (keyDataStr == undefined)
                                                      {
                                                          keyDataStr = '';
                                                      }
                                                      
                                                      // まだ保持されていないWindowsIDだけを保持する
                                                      var isSaveWindowsId = true;
                                                      if (keyDataStr)
                                                      {
                                                          if (isIndexOf(keyDataStr, String(activeWindowId)))
                                                          {
                                                              isSaveWindowsId = false;
                                                          }
                                                      }
                                                      if (isSaveWindowsId)
                                                      {
                                                          if (keyDataStr != '')
                                                          {
                                                              keyDataStr += COMMA;
                                                          }
                                                          
                                                          keyDataStr += String(activeWindowId);
                                                          chrome.storage.local.set({[SESSION_STORAGEKEYLIST]: keyDataStr});
                                                      }
                                                  }
                                            );
                                            
                                            createLog(EXTENSION_VER + TAB + SHAREDMEM_BROWSE + TAB + tabBrowseInfo);
                                        }
                                    }
                              );
                          }
                      }
                );
            }
            else
            {
                isFocusedWindow = false;
            }
        }
    );
}

/*************************************************************/
/* 閲覧データ削除用ファンクション
/*************************************************************/
function removeStorageKey()
{
    // 開いているChromeウィンドウの情報をすべて取得する
    chrome.windows.getAll(
        function(windows)
        {
            chrome.storage.local.get(
                SESSION_STORAGEKEYLIST
                , function(value)
                  {
                      // 開いているChromeウィンドウのWindowsIDを取得する
                      var windowsIdList = new Array();
                      for (var i=0; i<windows.length; i++)
                      {
                          windowsIdList.push(String(windows[i].id));
                      }
                      
                      // 保持しているWindowsIDを取得する
                      var keyDataStr = value[SESSION_STORAGEKEYLIST];
                      if (keyDataStr == undefined)
                      {
                          keyDataStr = '';
                      }
                      
                      // 閉じてしまったChromeウィンドウのWindowIDから不要な閲覧データを削除する
                      if (keyDataStr && (windowsIdList.length > 0))
                      {
                          var keyList = keyDataStr.split(COMMA);
                          for (var i=0; i<keyList.length; i++)
                          {
                              var key = keyList[i];
                              if (windowsIdList.indexOf(key) == -1)
                              {
                                  chrome.storage.local.remove(SESSION_LAST_ACCESS_TAB_TITLE + UNDER_SCORE + key);
                              }
                          }
                          
                          // 削除したWindowsIDは取り除く
                          chrome.storage.local.set({[SESSION_STORAGEKEYLIST]: windowsIdList.join(COMMA)});
                      }
                  }
            );
        }
    );
}

/*************************************************************/
/* コンテンツスクリプトからログ情報を受信する
/*************************************************************/
function recieveContentScriptLogInfo(msg)
{
    var uploadFileName = '';

    if (msg.logType == LOGTYPE_UPLOAD)
    {
        uploadFileName = msg.uploadFileName;
        // アップロードログ情報をセット
        setUploadLog(uploadFileName);
    }
}

/*************************************************************/
/* 100ミリ秒間隔で特定の処理を繰り返す
/*************************************************************/
function repeat(name, callbackFunc) 
{
    if (name === 'lspWaoGcBrowsingLog')
    {
        // setIntervalのカウントが0の場合は再登録する
        if (browsingCount == 0)
        {
            if (intervalId != 0)
            {
                clearInterval(intervalId);
            }
            
            // 1秒間隔で無名関数を実行
            intervalId = setInterval(function () 
            {
                browsingCount++;
                
                // 完了時、コールバック関数を実行
                if (callbackFunc) callbackFunc();
            }, 100);
        }
        else
        {
            browsingCount = 0;
        }
    }
    else if (name === 'sendUploadLog')
    {
        // setIntervalのカウントが0の場合は再登録する
        if (uploadCount == 0)
        {
            if (uploadLogIntervalId != 0)
            {
                clearInterval(uploadLogIntervalId);
            }
            
            // 1秒間隔で無名関数を実行
            uploadLogIntervalId = setInterval(function () 
            {
                uploadCount++;
                
                // 完了時、コールバック関数を実行
                if (callbackFunc) callbackFunc();
            }, 100);
        }
        else
        {
            uploadCount = 0;
        }
    }
}

/*************************************************************/
/* ログ取得処理
/*************************************************************/
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'lspWaoGcBrowsingLog')
    {
        repeat(alarm.name, function()
        {
            lspWaoGcBrowsingLog();
        });
    } 
    else if (alarm.name === 'sendUploadLog')
    {
        repeat(alarm.name, function()
        {
            sendUploadLog();
        });
    }
    else if (alarm.name === 'removeStorageKey')
    {
        removeStorageKey();
    }
});

/*************************************************************/
/* ログ取得用API
/*************************************************************/
function setEventAddListener(uploadLogInterval)
{
    const URL_FILTER_HTTP = 'http://*/*';
    const URL_FILTER_HTTPS = 'https://*/*';
    const REQUESTBODY = 'requestBody';
    const REQUESTHEADERS = 'requestHeaders';

    // 初回のログ取得処理登録
    repeat("lspWaoGcBrowsingLog", function()
    {
        lspWaoGcBrowsingLog();
    });
    
    repeat("sendUploadLog", function()
    {
        sendUploadLog();
    });

    // 閲覧ログ用API
    chrome.alarms.create("lspWaoGcBrowsingLog", { periodInMinutes: 1 });

    // アップロードログ用API
    chrome.alarms.create("sendUploadLog", { periodInMinutes: 1 });

    // 不要なストレージ削除用API
    chrome.alarms.create("removeStorageKey", { delayInMinutes: 1, periodInMinutes: 10 });

    // Webアップロードログ、Webメール送信ログ用API
    chrome.webRequest.onBeforeRequest.addListener(webBeforeRequest
                                                , { urls: [URL_FILTER_HTTP, URL_FILTER_HTTPS] }
                                                , [REQUESTBODY]
                                                 );

    // office365メール送信ログ、10KB未満のファイルアップロードログ用API
    chrome.webRequest.onBeforeSendHeaders.addListener(webBeforeSendHeaders
                                                    , { urls: [URL_FILTER_HTTP, URL_FILTER_HTTPS] }
                                                    , [REQUESTHEADERS]
                                                     );

    // Webダウンロードログ用API
    chrome.downloads.onCreated.addListener(lspWaoGcDownloadLog);

    // コンテンツスクリプトからのログ情報受信用API
    chrome.runtime.onMessage.addListener(recieveContentScriptLogInfo);
    
}

/*************************************************************/
/* エスケープ文字の置換
/* 「\」を空で置換する
/*************************************************************/
function replaceEscape(value)
{
    var targetStr = value;
    targetStr = targetStr.replace(/(\\\")/g, '\"');
    targetStr = targetStr.replace(/(\\\|)/g, '\|');
    targetStr = targetStr.replace(/(\\\{)/g, '\{');
    targetStr = targetStr.replace(/(\\\})/g, '\}');
    targetStr = targetStr.replace(/(\\\[)/g, '\[');
    targetStr = targetStr.replace(/(\\\])/g, '\]');
    targetStr = targetStr.replace(/(\\\,)/g, '\,');
    targetStr = targetStr.replace(/(\\\:)/g, '\:');
    targetStr = targetStr.replace(/(\\\\)/g, '\\');
    return targetStr;
}

/*************************************************************/
/* 特殊文字の置換
/*************************************************************/
function replaceSpecialChar(value)
{
    var targetStr = value;
    targetStr = targetStr.replace(/(&nbsp;)/g, ' ');
    targetStr = targetStr.replace(/(&lt;)/g, '<');
    targetStr = targetStr.replace(/(&gt;)/g, '>');
    targetStr = targetStr.replace(/(&amp;)/g, '&');
    return targetStr;
}

/*************************************************************/
/* 文字列切り出し処理
/* 対象の文字列で挟まれた部分を切り出す(単一)
/*************************************************************/
function getTargetStrSingle(startStr, endStr, baseStr)
{
    var outputStr = '';
    var indexS = 0;
    var indexE = 0;

    indexS = baseStr.indexOf(startStr);
    
    if (endStr != '') {
        indexE = baseStr.indexOf(endStr, indexS + startStr.length);
    }
    
    if (indexE == 0) {
        outputStr = baseStr.substring(indexS + startStr.length);
    }
    else
    {
        outputStr = baseStr.substring(indexS + startStr.length, indexE);
    }
    
    return outputStr;
}

/*************************************************************/
/* ChatGPTの書き込みログ
/*************************************************************/
function getChatGptPostMessage(details)
{
    const KEY_PARTS = 'parts';
    var parts = '';
    var partsString = '';
    if (details.requestBody.raw && details.requestBody.raw.length > 0)
    {
        if (details.requestBody.raw[0].bytes)
        {
            var buff = new Uint8Array(details.requestBody.raw[0].bytes);
            const decoder = new TextDecoder('utf-8');
            const strChatGptData = decoder.decode(buff);
            if (strChatGptData != '')
            {
                // リクエスト内容のJSONから投稿文面を抽出する
                // content内のparts配列が該当部分
                delete buff;
                var jsonObj = JSON.parse(strChatGptData);
                if (!(parts = getValueFromJson(jsonObj, KEY_PARTS))){
                    return;
                }
                partsString = parts.join(' ');

                // 改行文字を半角スペースに置換する
                partsString = replaceBeforeToAfter(partsString, ALL_LINE_BREAK, HALF_SPACE);
                // タブ文字を半角スペースに置換する
                partsString = replaceBeforeToAfter(partsString, TAB, HALF_SPACE);
                // 共有メモリ書き込み
                sendWebMailLog(partsString, details.url);
            }
        }
    }
}