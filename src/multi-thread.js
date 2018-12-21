/*
 * @Author: Jindai Kirin 
 * @Date: 2018-12-15 16:03:55 
 * @Last Modified by: Jindai Kirin
 * @Last Modified time: 2018-12-21 20:00:12
 */

function sleep(ms) {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}

/**
 * 伪多线程
 *
 * @class MultiThread
 */
class MultiThread {
	/**
	 * Creates an instance of MultiThread.
	 * @param {Array} taskList 任务参数队列
	 * @param {number} threadNum 线程数
	 * @memberof MultiThread
	 */
	constructor(taskList, threadNum) {
		this.tasks = taskList.slice();
		this.num = threadNum;
		this.hasRun = false;
	}

	/**
	 *	执行多线程
	 *
	 * @param {Function} promiseFunc 用于创建Promise实例的函数
	 * @param {number} [interval=0] 线程建立时间间隔
	 * @returns Promise.all
	 * @memberof MultiThread
	 */
	async run(promiseFunc, interval = 0) {
		if (this.hasRun) return null;
		this.hasRun = true;
		let threads = [];
		let taskIndex = 0;
		//创建线程
		for (let threadID = 0; threadID < this.num; threadID++) {
			threads.push(new Promise(async resolve => {
				while (true) {
					let i = taskIndex++;
					if (i >= this.tasks.length) break;
					await promiseFunc(threadID, this.tasks[i], i + 1, this.tasks.length);
				}
				resolve();
			}));
			await sleep(interval);
		}
		return Promise.all(threads);
	}
}

module.exports = MultiThread;
