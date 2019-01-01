/*
 * @Author: Jindai Kirin 
 * @Date: 2018-12-15 23:04:25 
 * @Last Modified by: Jindai Kirin
 * @Last Modified time: 2019-01-01 17:46:14
 */

const NHentaiAPI = new(require('nhentai-api'))();
const MultiThread = require('./multi-thread');
const OS = require('os');

const EXT = {
	j: 'jpg',
	p: 'png',
	g: 'gif'
}

/**
 * nhentai解析
 *
 * @class Analysiser
 */
class Analysiser {
	constructor(agent = false) {
		if (agent) this.Axios = require('axios').create({
			httpsAgent: agent
		});
		else this.Axios = require('axios');
	}

	callAPI(url) {
		return this.Axios.get(url).catch(e => {
			if (e.code == 'ECONNRESET') {
				console.error('Connection reset detected.');
				return this.callAPI(url);
			} else if (e.response && e.response.status == 503) {
				console.error('503 error detected, please try to reduce the number of analysis threads in the settings.'.bgRed);
				process.exit();
			} else {
				throw e;
			}
		});
	}

	/**
	 * 获取单个本子信息
	 *
	 * @param {number} bookID 本子ID
	 * @returns 本子信息
	 * @memberof Analysiser
	 */
	async getBook(bookID) {
		let details = await this.callAPI(NHentaiAPI.bookDetails(bookID)).then(ret => ret.data);
		return parseBookDetails(details);
	}

	/**
	 * 从搜索中获取多个本子信息
	 *
	 * @param {string} query 查询字串
	 * @param {number} [start=1] 起始页数
	 * @param {number} [end=1] 终止页数
	 * @returns 本子信息数组
	 * @memberof Analysiser
	 */
	async getBooksFromSearch(query, start = 1, end = 1, thread = 1) {
		query = decodeURI(query);
		let result = [];

		//first
		console.log(`  [-]\t${'-'.green}/-\tCollecting ` + 'query='.gray + query + ' page='.gray + start);
		let firstSearch = await this.callAPI(NHentaiAPI.search(encodeURI(query), start)).then(ret => ret.data);
		let numPages = firstSearch.num_pages;
		for (let details of firstSearch.result) {
			result.push(parseBookDetails(details));
		}

		//剩余任务队列
		let tasks = [];
		for (let page = start + 1; page <= end && page <= numPages; page++) {
			tasks.push(NHentaiAPI.search(encodeURI(query), page));
		}

		let multiThread = new MultiThread(tasks, thread);
		await multiThread.run((threadID, apiURL, index, total) => new Promise(async resolve => {
			console.log(`  [${threadID}]\t${String(index).green}/${total}\tCollecting ` + 'query='.gray + query + ' page='.gray + (start + index));
			let search = await this.callAPI(apiURL).then(ret => ret.data);
			for (let details of search.result) {
				result.push(parseBookDetails(details));
			}
			resolve();
		}), 200);

		return result;
	}
}

/**
 * 解析本子信息
 *
 * @param {*} details 本子原始JSON
 * @returns 本子信息
 */
function parseBookDetails(details) {
	let {
		id,
		images: {
			pages
		},
		media_id,
		num_pages,
		tags,
		title: {
			english,
			japanese,
			pretty
		}
	} = details;

	if (!japanese) japanese = english;

	//图片文件名
	let parsePages = [];
	for (let i = 0; i < pages.length; i++) {
		let t = pages[i].t;
		if (!EXT[t]) throw new Error(`Unknown page type ${t}.`);
		parsePages.push(`${i+1}.${EXT[t]}`);
	}

	//语言Tag
	let language = '';
	for (let tag of tags) {
		if (tag.type == 'language' && tag.name != 'translated') {
			language = tag.name;
			break;
		}
	}

	let prePretty = english.split(pretty)[0];
	if (prePretty == english) prePretty = '';

	let title_pretty = (prePretty + pretty).replace(/[^0-9a-zA-Z]+/g, ' ').trim();
	if (title_pretty.length == 0) title_pretty = pretty;

	//系统限制的文件名最大长度
	let title_dir = japanese.replace(/[/\\:*?"<>|.&$ ]+/g, ' ') + ` (${id})`;
	switch (OS.platform()) {
		case 'win32':
		case 'darwin':
			break;
		default:
			title_dir = cutStringByUTF8Length(title_dir, 249);
			break;
	}

	return {
		id,
		media_id,
		title: japanese,
		title_pretty,
		title_dir,
		language,
		num_pages,
		pages: parsePages
	};
}

/**
 * 按 UTF-8 真实长度截取字符串
 *
 * @param {string} str 字符串
 * @param {number} len 目标最大长度
 * @returns 截取后的字符串
 */
function cutStringByUTF8Length(str, len) {
	let trueLen = 0;
	let i = 0;
	for (; i < str.length; i++) {
		str.charCodeAt(i) > 127 ? trueLen += 3 : trueLen++;
		if (trueLen > len) break;
	}
	if (trueLen > len) return str.slice(0, i);
	return str;
}

module.exports = Analysiser;
