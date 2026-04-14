/*************************************************************/
/* 定数
/*************************************************************/
const GMAIL_SIMPLE = 0;
const GMAIL_SIMPLE_QUICK = 1;
const GMAIL_HTML = 2;
const GET_UPFILENAME_GMAIL = 0;
const GET_FROMADDRESS_GMAIL = 1;
const GET_UPFILENAME_FROM_OFFICE365 = 2;
const SET_UPFILENAME_OFFICE365 = 3;
const GET_FROM_TO_GMAIL_QUICK = 4;
const SET_FROM_OFFICEONLINE = 5;

const SESSION_UPFILENAME_OFFICE365 = 'LspUpFileNameOffice365-1060';
const SESSION_FROM_OFFICEONLINE = 'LspFromOfficeOnline-1060';
const SEMI_COLON = ';';
const SESSION_TABID = 'tabid';

const TAG_NAME_TABLE = 'table';
const TAG_NAME_B = 'b';
const TAG_NAME_INPUT = 'input';
const TAG_NAME_TBODY = 'tbody';
const TAG_NAME_SPAN = 'span';
const TAG_NAME_HTML = 'html';

const LANG_CHINA = 'zh-CN';

const ELEMENT_NAME_FILE0 = 'file0';
const ELEMENT_NAME_COMPOSEID = 'composeid';
const ELEMENT_NAME_TO_QUICK = 'qrr';
const ELEMENT_NAME_ARIALABEL = 'aria-label';

const GMAIL_HTML_ATTACH_LOCAL_FILE_CLASS_NAME = 'vI';
const GMAIL_HTML_ATTACH_DRIVE_FILE_CLASS_NAME = 'gmail_chip gmail_drive_chip';
const GMAIL_SIMPLE_FROM_CLASS_NAME = 'gb4';

const OFFICE365_WINDOW_SEND_ID = "[id^='docking_InitVisiblePart_']";
const OFFICE365_ATTACH_FILE_ID = 'div [role=\"option\"]:not([type=\"button\"])';
const OFFICE365_ATTACH_ED_JP = ' 開く';
const OFFICE365_ATTACH_ED_EN = ' Open';
const OFFICE_ONLINE_FROM_ID= '#O365_AppName';
const OFFICE_ONLINE_FROM_ED = 'login_hint=';

const FAKEPATH = 'fakepath';
const COMMA = ',';
const ASTERISK = '*';

var setFileNameTime = new Date();

/*************************************************************/
/* HTMLアクセス用ファンクション
/*************************************************************/
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse)
    {
        // Gmail送信時にHTMLタグからアップロードファイル名を取得する
        if (request.action == GET_UPFILENAME_GMAIL)
        {
            var upFileArray = new Array();
            var upFileName = '';
            if (request.dispFlg == GMAIL_SIMPLE)
            {
                // 簡易版の場合
                var arrayIndex = 0;
                var inputItems = document.getElementsByTagName(TAG_NAME_INPUT);
                
                for (var i = 0; i < inputItems.length; i++)
                {
                    // チェックボックスのチェックが「ON」の場合にファイル名を取得する
                    if (inputItems.item(i).checked)
                    {
                        // 言語設定が中国(簡体)の場合
                        if (document.getElementsByTagName(TAG_NAME_HTML)[0].lang == LANG_CHINA)
                        {
                            // aria-labelの値の2文字分はサービス側で「附件」が付与されている為、3文字目から取得
                            upFileArray[arrayIndex] = inputItems.item(i).attributes[ELEMENT_NAME_ARIALABEL].value.substring(2);
                        }
                        else
                        {
                            upFileArray[arrayIndex] = inputItems.item(i).attributes[ELEMENT_NAME_ARIALABEL].value;
                            upFileArray[arrayIndex] = upFileArray[arrayIndex].substring(upFileArray[arrayIndex].indexOf(' ') + 1);
                        }
                        arrayIndex++;
                    }
                }

                // ファイルを選択ボタンから選択している添付ファイルの取得
                var selectFile = document.getElementsByTagName(TAG_NAME_INPUT)[ELEMENT_NAME_FILE0].value;
                if (selectFile != '')
                {
                    var index = selectFile.indexOf(FAKEPATH);
                    selectFile = selectFile.substring(index + 9);
                    upFileArray[arrayIndex] = selectFile;
                }
            }
            else if (request.dispFlg == GMAIL_HTML)
            {
                // 標準版の場合
                var tbodyElements = null;
                var inputElements = null;
                var targetTbodyElement = null;
                var isTargetTbody = false;
                var upFileCount = 0;
                var uploadFileSpanElements = null;

                tbodyElements = document.getElementsByTagName(TAG_NAME_TBODY);
                for (ii = 0; ii < tbodyElements.length; ii++)
                {
                    inputElements = tbodyElements[ii].getElementsByTagName(TAG_NAME_INPUT);
                    for (jj = 0; jj < inputElements.length; jj++)
                    {
                        // postdataから取得したcomposeidとhtmlのcomposeidの値が合致する場合、処理対象のtbodyとする
                        // ※複数メッセージを表示してメール送信した場合に複数のログが純I・ﾄしまう為の対策
                        if (inputElements[jj].name.toLowerCase() == ELEMENT_NAME_COMPOSEID)
                        {
                            if (request.composeId == inputElements[jj].value)
                            {
                                isTargetTbody = true;
                                targetTbodyElement = tbodyElements[ii];
                                break;
                            }
                        }
                    }
                }

                // 処理対象のtbodyから添付ファイル名を取得
                if (isTargetTbody)
                {
                    // 「D&D」、「ファイルを添付」でファイル添付した場合
                    var upFiles = targetTbodyElement.getElementsByClassName(GMAIL_HTML_ATTACH_LOCAL_FILE_CLASS_NAME);
                    for (var i = 0; i < upFiles.length; i++)
                    {
                        upFileArray[i] = upFiles.item(i).innerHTML;
                        upFileCount++;
                    }

                    // 「ドライブを使用してファイルを挿入」でファイル添付した場合
                    var upFilesDrive = targetTbodyElement.getElementsByClassName(GMAIL_HTML_ATTACH_DRIVE_FILE_CLASS_NAME);
                    for (var j = 0; j < upFilesDrive.length; j++)
                    {
                        uploadFileSpanElements = upFilesDrive[j].getElementsByTagName(TAG_NAME_SPAN);
                        for (k = 0; k < uploadFileSpanElements.length; k++)
                        {
                            upFileArray[upFileArray.length] = uploadFileSpanElements[k].innerHTML;
                        }
                    }
                }
            }
            for (var i = 0; i < upFileArray.length; i++)
            {
                if (upFileName != '')
                {
                    upFileName += SEMI_COLON;
                }
                upFileName += upFileArray[i];
            }
            sendResponse(upFileName);
        }
        // Gmail送信時にHTMLタグからFrom(送信者)を取得する(簡易版Gmail)
        else if (request.action == GET_FROMADDRESS_GMAIL)
        {
            var emailAddress = document.getElementsByClassName(GMAIL_SIMPLE_FROM_CLASS_NAME).item(0).innerHTML;
            sendResponse(emailAddress);
        }
        // office365のメール送信時に添付ファイル名とFrom情報を取得する
        else if (request.action == GET_UPFILENAME_FROM_OFFICE365)
        {
            chrome.storage.local.get(
                [SESSION_TABID, SESSION_UPFILENAME_OFFICE365, SESSION_FROM_OFFICEONLINE]
                , function(value)
                  {
                      var upFileName = '';
                      var fromAddress = '';
                      var tabID = value[SESSION_TABID];
                      if (tabID == request.TABID){
                          upFileName = value[SESSION_UPFILENAME_OFFICE365];
                          fromAddress = value[SESSION_FROM_OFFICEONLINE];
                      }
                      // アドレスとファイル名に利用できない「*」で2つのデータを区切る
                      console.log(`====GET_UPFILENAME_FROM_OFFICE365 : ${upFileName}*${fromAddress}`);
                      sendResponse(upFileName + ASTERISK + fromAddress);
                      chrome.storage.local.set({[SESSION_UPFILENAME_OFFICE365]: null});
                  }
            );
        }
        // office365のメール作成時に添付ファイル名を保持しておく
        else if (request.action == SET_UPFILENAME_OFFICE365)
        {
            var upFileName = '';
            var DeleteFlag = request.flag;
            
            // メールを送信時に取得できるIDから添付ファイル名の要素を取得する
            var sendData = document.querySelector(OFFICE365_WINDOW_SEND_ID);
            
            if (sendData != null)
            {
                // 添付ファイル名の取得
                var upFiles = sendData.querySelectorAll(OFFICE365_ATTACH_FILE_ID);
                if (upFiles.length > 0)
                {
                    for (var i = 0; i < upFiles.length; i++)
                    {
                        if (upFileName != '')
                        {
                            upFileName += SEMI_COLON;
                        }
                        
                        var fileData = upFiles[i].ariaLabel;
                        if(fileData != null)
                        {
                            var FileEd = fileData.indexOf(OFFICE365_ATTACH_ED_JP);
                            // 見つからない場合は英語表示で再取得する
                            if (FileEd == -1)
                            {
                                FileEd = fileData.indexOf(OFFICE365_ATTACH_ED_EN);
                            }
                            
                            upFileName += fileData.substring(0, FileEd);
                        }
                    }
                }
            }
            
            var now = new Date();
            // 空文字以外の別の添付ファイル名があれば変更する
            if(upFileName != '' || DeleteFlag == true){
                setFileName();
            }
            // 前回保持してから5秒以内は空文字を取得しない
            else if ((now.getTime() - setFileNameTime.getTime()) >= 5000) {
                setFileName();
            }
            function setFileName(){
                chrome.storage.local.set({[SESSION_UPFILENAME_OFFICE365]: upFileName});
                chrome.storage.local.set({[SESSION_TABID]: request.tabid});
                console.log(`====SET_UPFILENAME_OFFICE365 : ${upFileName}`);
                //保持した時間を更新
                setFileNameTime = new Date();
            };
            sendResponse(upFileName);
        }
        // Gmailクイック返信時にHTMLタグからFrom(送信者)、To(宛先)を取得する(簡易版Gmail)
        else if (request.action == GET_FROM_TO_GMAIL_QUICK)
        {
            var emailAddress = '';
            var fromAddress = '';
            var toAddress = '';
            var mailLogToElements = null;
            var len = 0;

            // From取得
            fromAddress = document.getElementsByClassName(GMAIL_SIMPLE_FROM_CLASS_NAME).item(0).innerHTML;

            // To取得
            mailLogToElements = document.getElementsByName(ELEMENT_NAME_TO_QUICK);

            len = mailLogToElements.length;
            // 選択肢が「To」のみの場合
            if (len == 1)
            {
                toAddress = mailLogToElements[0].nextSibling.data;
            }
            // 選択肢が「To」と「全員に」の場合
            else
            {
                for (ii = 0; ii < len; ii++)
                {
                    if (mailLogToElements[ii].checked)
                    {
                        // 言語設定が中国(簡体)の場合
                        if (document.getElementsByTagName(TAG_NAME_HTML)[0].lang == LANG_CHINA)
                        {
                            // HTMLから取得した内容の先頭に「:」が付く為、2文字目から取得
                            toAddress = mailLogToElements[ii].parentElement.parentElement.getElementsByTagName('b')[0].nextSibling.data.substring(1);
                        }
                        else
                        {
                            toAddress = mailLogToElements[ii].parentElement.parentElement.getElementsByTagName('b')[0].nextSibling.data;
                        }
                        // 1文字目に半角空白入っている為、trimする
                        toAddress = toAddress.trim();
                        break;
                    }
                }
            }
            emailAddress = fromAddress + COMMA + toAddress;
            sendResponse(emailAddress);
        }
        // OfficeOnlineのメール送信時にFrom情報を保持しておく
        else if (request.action == SET_FROM_OFFICEONLINE)
        {
            var fromAddress = '';
            
            // Office Onlineの場合、通信のヘッダー情報からFrom情報が取得できないため、
            // DOMの解析からFrom情報を取得する
            var fromItem = document.querySelector(OFFICE_ONLINE_FROM_ID);
            
            // From情報の取得
            if (fromItem != null)
            {
                if (fromItem.href != null)
                {
                    var FileSt = fromItem.href.indexOf(OFFICE_ONLINE_FROM_ED);
                    fromAddress = fromItem.href.substring(FileSt + OFFICE_ONLINE_FROM_ED.length);
                    
                    // URLから取得したFrom情報をデコードする
                    if(fromAddress)
                    {
                        fromAddress = fromAddress.replace('%40', '@');
                    }
                }
            }
            
            console.log(`====SET_FROM_OFFICEONLINE : ${fromAddress}`);
            chrome.storage.local.set({[SESSION_FROM_OFFICEONLINE]: fromAddress});
            sendResponse(fromAddress);
        }
        
        return true;
    }
);
