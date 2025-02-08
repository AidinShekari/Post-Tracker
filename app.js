const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const UserAgent = require('user-agents');
const path = require('path'); 

class PostTracker {
    constructor() {
        this.client = axios.create({
            baseURL: 'https://tracking.post.ir',
            headers: {
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
                'Origin': 'https://tracking.post.ir',
                'Referer': 'https://tracking.post.ir/search.aspx',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'User-Agent': new UserAgent().toString(),
                'X-Requested-With': 'XMLHttpRequest',
            }
        });

        this.lastFetchedContent = '';  
    }

    async getViewState(trackingCode) {
        const response = await this.client.get(`/search.aspx?id=${trackingCode}`);
        const $ = cheerio.load(response.data);
        const viewstate = $('input#__VIEWSTATE').val();
        const eventValidation = $('input#__EVENTVALIDATION').val();
        return { viewstate, eventValidation };
    }

    async getTrackingPost(trackingCode) {
        try {
            const { viewstate, eventValidation } = await this.getViewState(trackingCode);

            const payload = new URLSearchParams({
                'scripmanager1': 'pnlMain|btnSearch',
                '__LASTFOCUS': '',
                'txtbSearch': trackingCode,
                'txtVoteReason': '',
                'txtVoteTel': '',
                '__EVENTTARGET': 'btnSearch',
                '__EVENTARGUMENT': '',
                '__VIEWSTATE': viewstate,
                '__VIEWSTATEGENERATOR': 'BBBC20B8',
                '__VIEWSTATEENCRYPTED': '',
                '__EVENTVALIDATION': eventValidation,
                '__ASYNCPOST': 'true',
            });

            const response = await this.client.post('/search.aspx', payload.toString(), {
                headers: {
                    ...this.client.defaults.headers,
                    'X-MicrosoftAjax': 'Delta=true',
                }
            });

            await this.savePnlResultTextToFile(response.data);
        } catch (error) {
            console.error('Error while tracking:', error);
        }
    }

    async savePnlResultTextToFile(pageHtml) {
        const $ = cheerio.load(pageHtml);

        const rows = $('#pnlResult .row.newrowdata');

        let formattedText = '📦 وضعیت جدید پستی\n\n';

        rows.each((index, row) => {
            const cells = $(row).find('.newtddata');
            const time = $(cells[0]).text().trim();
            const action = $(cells[1]).text().trim();
            const location = $(cells[2]).text().trim(); 

            formattedText += `⏰ زمان: ${time} | \n📍 مکان: ${location} \n🔎 وضعیت: ${action}\n\n`;
        });

        const filePath = path.join(__dirname, 'formatted_tracking_info.txt');

        fs.readFile(filePath, 'utf8', (err, currentContent) => {
            if (err && err.code !== 'ENOENT') {
                console.error('Error reading file:', err);
                return;
            }

            if (formattedText !== currentContent) {
                fs.writeFile(filePath, formattedText, 'utf8', (err) => {
                    if (err) {
                        console.error('Error writing to file:', err);
                    } else {
                        console.log('📝 اطلاعات جدید پستی ذخیره شد.');
                        this.sendToAPI(formattedText);
                    }
                });
            } else {
                console.log('🛑 هیچ تغییری در وضعیت پستی مشاهده نشد.');
            }
        });
    }

    async sendToAPI(message) {
        try {
            const response = await axios.post('my-api', {
                channel_id: -channel-id,
                message: message
            });
            console.log('✅ پیام با موفقیت ارسال شد:', response.data);
        } catch (error) {
            console.error('❌ خطا در ارسال پیام به API:', error);
        }
    }
}

function trackPackageEvery30Seconds() {
    const trackingCode = 'example-track-code';
    const tracker = new PostTracker();

    setInterval(async () => {
        console.log('🔄 در حال دریافت وضعیت پستی...');
        try {
            await tracker.getTrackingPost(trackingCode);
        } catch (error) {
            console.error('❌ خطا در دریافت وضعیت پستی:', error);
        }
    }, 5000); 
}

trackPackageEvery30Seconds();
