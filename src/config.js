/*
 * @Author: Jindai Kirin 
 * @Date: 2018-12-15 21:16:02 
 * @Last Modified by: Jindai Kirin
 * @Last Modified time: 2018-12-18 15:11:03
 */

const Fse = require('fs-extra');
const Path = require('path');
const SocksProxyAgent = require('socks-proxy-agent');
const HttpsProxyAgent = require('https-proxy-agent');

const isValidPath = require('is-valid-path');

const configDir = require('appdata-path').getAppDataPath('nhder');
const configFile = Path.join(configDir, 'config.json');
const tempDir = Path.join(configDir, 'temp');

const defaultConfig = {
	path: '',
	thread: 8,
	timeout: 30,
	deduplication: true,
	languages: ['chinese', 'japanese'],
	proxy: ''
};

class Config {
	constructor() {
		if (!Fse.existsSync(configFile)) {
			Fse.ensureDirSync(configDir);
			Fse.writeJsonSync(configFile, defaultConfig);
		}
		this.data = Fse.readJsonSync(configFile);
	}

	check() {
		let {
			path,
			thread,
			timeout,
			deduplication,
			languages,
			proxy
		} = this.data;
		let confErr = false;

		if (typeof path != 'string' || !isValidPath(path)) {
			this.data.path = defaultConfig.path;
			confErr = true;
		}
		if (typeof thread != 'number') {
			this.data.thread = defaultConfig.thread;
			confErr = true;
		}
		if (typeof timeout != 'number') {
			this.data.timeout = defaultConfig.timeout;
			confErr = true;
		}
		if (typeof deduplication != 'boolean') {
			this.data.deduplication = defaultConfig.deduplication;
			confErr = true;
		}
		if (!Array.isArray(languages)) {
			this.data.languages = defaultConfig.languages;
			confErr = true;
		}
		if (typeof proxy != 'string') {
			this.data.proxy = defaultConfig.proxy;
			confErr = true;
		}

		if (confErr) {
			this.saveConfig();
			console.log('Config error detected, restored them to default.\n'.red);
		}

		if (this.data.path.length == 0) {
			console.error('You must set download path first!'.red + '\nTry ' + 'nhder --setting'.yellow);
			return false;
		};

		return true;
	}

	getProxyAgent() {
		let proxy = this.data.proxy;
		if (proxy.search('http://') === 0) return new HttpsProxyAgent(proxy);
		if (proxy.search('socks://') === 0) return new SocksProxyAgent(proxy, true);
		return false;
	}

	getConfig() {
		return this.data;
	}

	saveConfig(config = null) {
		if (config) this.data = config;
		Fse.writeJsonSync(configFile, this.data);
	}

	getConfigDir() {
		return configDir;
	}

	getTempDir() {
		return tempDir;
	}
}

module.exports = new Config();
