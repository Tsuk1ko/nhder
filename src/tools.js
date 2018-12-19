/*
 * @Author: Jindai Kirin 
 * @Date: 2018-12-16 12:41:48 
 * @Last Modified by: Jindai Kirin
 * @Last Modified time: 2018-12-20 02:35:13
 */

const Fse = require('fs-extra');
const Path = require('path');

const gReg = /^https?:\/\/nhentai\.net\/g\/([0-9]+)\/?$/;
const tagReg = /^https?:\/\/nhentai\.net\/[^\/?=]+\/([^\/?=]+)(\/(\?page=([0-9]+))?)?$/;
const searchReg = /^https?:\/\/nhentai\.net\/search\/\?q=([^&]+)()(&page=([0-9]+))?$/;


/**
 * 解析用户输入的URL
 *
 * @param {string} url nhentai URL
 * @returns 解析结果
 */
function parseNHURL(url) {
	let type, value, page;
	let search = gReg.exec(url);
	if (search) {
		type = 'g';
		value = parseInt(search[1]);
	} else {
		search = tagReg.exec(url) || searchReg.exec(url);
		if (search) {
			type = 's';
			value = search[1];
			page = search[4]
		} else {
			return false;
		}
	}
	return {
		type,
		value,
		page: parseInt(page) || false
	};
}

/**
 * 过滤本子
 *
 * @param {Array} bookList 本子数组
 * @param {boolean} deduplication 去重
 * @param {Array} languages 语言
 * @returns 过滤后的本子数组
 */
function bookFilter(bookList, deduplication, languages) {
	let prettySet = [];
	let temp = [];
	let result = [];

	//语言过滤
	if (languages.length > 0) {
		for (let book of bookList) {
			if (languages.includes(book.language)) temp.push(book);
		}
	} else temp = [].concat(bookList);

	//去重
	if (deduplication) {
		//语言优先度
		if (languages.length > 1) {
			let langSet = [];
			for (let index in languages) {
				langSet[languages[index]] = index;
			}
			temp.sort((a, b) => {
				let compare = a.title_pretty.localeCompare(b.title_pretty);
				if (compare == 0)
					return langSet[a.language] - langSet[b.language];
				else return compare;
			});
		}
		//去重
		for (let book of temp) {
			let pretty = book.title_pretty;
			if (prettySet[pretty]) continue;
			prettySet[pretty] = true;
			result.push(book);
		}
	} else result = temp;

	return result.sort((a, b) => parseInt(b.id) - parseInt(a.id));
}

/**
 * 过滤已下载的本子和页
 *
 * @param {Array} bookList 本子列表
 * @param {string} dlDirRoot 下载目录
 * @returns 过滤后的本子数组
 */
function downloadedFilter(bookList, dlDirRoot) {
	let result = [];
	let fileList = Fse.readdirSync(dlDirRoot);
	for (let book of bookList) {
		let {
			title_dir,
			pages
		} = book;

		//检查文件夹
		if (fileList.includes(title_dir)) {
			let pageList = Fse.readdirSync(Path.join(dlDirRoot, title_dir));
			let pageResult = [];
			//检查页
			for (let page of pages) {
				if (!pageList.includes(page)) pageResult.push(page);
			}
			if (pageResult.length == 0) continue; //说明本子完整下载
			//将未下载的页列表作为本子页列表
			book.pages = pageResult;
		}

		result.push(book);
	}
	return result;
}

module.exports = {
	parseNHURL,
	bookFilter,
	downloadedFilter
};
