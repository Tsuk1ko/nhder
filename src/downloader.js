/*
 * @Author: Jindai Kirin 
 * @Date: 2018-12-16 00:56:02 
 * @Last Modified by: Jindai Kirin
 * @Last Modified time: 2018-12-27 01:03:56
 */

require('colors');
const Config = require('./config');
const Fse = require('fs-extra');
const Path = require('path');
const MultiThread = require('./multi-thread');

const RETRY_MAX = 10;

class NHDownloader {
	/**
	 * Creates an instance of NHDownloader.
	 * @param {Config} conf 配置
	 * @param {*} [agent=null] 代理
	 * @memberof NHDownloader
	 */
	constructor(conf, agent = null) {
		this.config = conf;
		if (agent) this.Axios = require('axios').create({
			httpsAgent: agent
		});
		else this.Axios = require('axios');
	}

	/**
	 * Axios下载至文件
	 *
	 * @param {string} dir 下载目录
	 * @param {string} filename 文件名
	 * @param {string} url 下载地址
	 * @param {*} [axiosOption={}] Axios选项
	 * @returns 下载到文件的Promise
	 * @memberof NHDownloader
	 */
	async axiosToFile(dir, filename, url, axiosOption = {}) {
		let response;
		axiosOption.responseType = 'stream';
		await this.Axios.get(url, axiosOption).then(res => response = res);
		return new Promise((reslove, reject) => {
			response.data.pipe(Fse.createWriteStream(Path.join(dir, filename)));
			response.data.on('end', () => {
				reslove(response);
			});
			response.data.on('error', e => {
				reject(e);
			});
		});
	}

	/**
	 * 下载本子
	 *
	 * @param {*} book 本子
	 * @param {number} [current=1] 当前总进度
	 * @param {number} [total=1] 总进度
	 * @returns 多线程Promise.all
	 * @memberof NHDownloader
	 */
	download(book, current = 1, total = 1) {
		let config = this.config.getConfig();
		let tmpDirRoot = this.config.getTempDir();
		let {
			id,
			media_id,
			title,
			title_dir,
			num_pages,
			pages
		} = book;

		console.log('\n' + String(current).green + `/${total}\t` + `[${id}] `.gray + title + ` (${num_pages} pages)`.yellow);

		let tmpDir = Path.join(tmpDirRoot, `${id}`);
		let dlDir = Path.join(config.path, title_dir);

		Fse.ensureDirSync(tmpDir);
		try {
			Fse.ensureDirSync(dlDir);
		} catch (e) {
			if (e.code == 'ENAMETOOLONG') {
				dlDir = Path.join(config.path, cutStringByTrueLength(title_dir, 255));
				Fse.ensureDirSync(dlDir);
			} else {
				throw e;
			}
		}

		let multiThread = new MultiThread(pages, config.thread);
		return multiThread.run((threadID, filename, index, total) => new Promise(async (resolve, reject) => {
			let url = `https://i.nhentai.net/galleries/${media_id}/${filename}`;
			let strTemplet = `\t${String(index).green}/${total}\t${url}`;

			console.log(`  [${threadID}]${strTemplet}`);

			let success = false;
			for (let retry = 0; retry < RETRY_MAX && !success; retry++) {
				await this.axiosToFile(tmpDir, filename, url, {
					timeout: 1000 * config.timeout
				}).then(async res => {
					//文件完整性校验
					let fileSize = res.headers['content-length'];
					let dlFile = Path.join(tmpDir, filename);
					let waitCnt = 0;
					do {
						waitCnt++;
						await sleep(500);
					} while (!Fse.existsSync(dlFile) && waitCnt <= 10); //不明bug处理
					let dlFileSize = Fse.statSync(dlFile).size;
					if (dlFileSize == fileSize) {
						Fse.moveSync(dlFile, Path.join(dlDir, filename));
						success = true;
					} else {
						Fse.unlinkSync(dlFile);
						throw new Error('Incomplete download.');
					}
				}).catch(e => {
					success = false;
					console.error(`${e}`.red);
					if (retry + 1 < RETRY_MAX)
						console.log('  ' + `[${threadID}]`.bgYellow + strTemplet);
					else
						console.log('  ' + `[${threadID}]`.bgRed + strTemplet);
				});
			}

			success ? resolve() : reject('Max retry.');
		}), 100);
	}
}

function sleep(ms) {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}

/**
 * 按 UTF-8 真实长度截取字符串
 *
 * @param {string} str 字符串
 * @param {number} len 目标最大长度
 * @returns 截取后的字符串
 */
function cutStringByTrueLength(str, len) {
	let trueLen = 0;
	let i = 0;
	for (; i < str.length; i++) {
		str.charCodeAt(i) > 127 ? trueLen += 3 : trueLen++;
		if (trueLen > len) break;
	}
	return str.slice(0, i);
}

module.exports = NHDownloader;
