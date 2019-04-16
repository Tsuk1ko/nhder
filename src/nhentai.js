/*
 * @Author: Jindai Kirin 
 * @Date: 2018-12-17 18:41:08 
 * @Last Modified by: Jindai Kirin
 * @Last Modified time: 2019-04-16 13:15:02
 */

const Tools = require('./tools');
const Downloader = require('./downloader');
const Analysiser = require('./analysiser');
const Fse = require('fs-extra');

async function download(target, range, config) {
	if (/^[0-9]+$/.test(target)) target = `https://nhentai.net/g/${parseInt(target)}/`;
	let {
		type,
		value,
		page
	} = Tools.parseNHURL(target);
	let {
		path,
		api_thread,
		deduplication,
		languages
	} = config.getConfig();

	Fse.ensureDirSync(path);

	const analysiser = new Analysiser(config.getProxyAgent());
	const downloader = new Downloader(config, config.getProxyAgent());

	switch (type) {
		case 'g':
			let book = await analysiser.getBook(value);
			let dlQueue = Tools.downloadedFilter([book], path);
			if (dlQueue.length > 0) return downloader.download(dlQueue[0]);
			console.log('\nAlready exists: '.green + `[${book.id}] `.gray + book.title + ` (${book.num_pages} pages)`.yellow);
			break;

		case 's':
			let start = 1;
			let end = 1;
			if (range) {
				start = range[0];
				end = range[1];
			} else if (page) {
				start = page;
				end = page;
			}
			console.log();
			let books = await analysiser.getBooksFromSearch(value, start, end, api_thread);
			books = Tools.bookFilter(books, deduplication, languages);
			books = Tools.downloadedFilter(books, path);
			if (books.length > 0) {
				for (let i = 0; i < books.length; i++) {
					await downloader.download(books[i], i + 1, books.length);
				}
			} else console.log('\nAll books exists.');
			break;

		default:
			console.error('\nError URL or gid\t'.red + target);
	}
}

module.exports = {
	download
};
