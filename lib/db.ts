type addOrUpdateDataRecord = {
  wordOrPhrase: string
  meaning: string
  id?: string
}
export default class VocabifyIndexDB {
  private dbname = 'VocabifyIndexDB'
  db: any
  constructor() {
    console.log('initialaze vocabify indexDB')
    this.db = this.openDatabase()
  }

  openDatabase() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbname, 1)
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBRequest).result

        // 创建对象存储，设置 "id" 为主键
        if (!db.objectStoreNames.contains('dataStore')) {
          const store = db.createObjectStore('dataStore', {
            keyPath: 'id',
            autoIncrement: true,
          })
          // 可创建额外索引: 目的用于查询，可以对单词进行查询，而不仅仅是主键
          store.createIndex('wordOrPhrase', 'wordOrPhrase', { unique: false })
          // 为时间戳创建索引: 目的用于日后有对时间范围过滤的需求
          store.createIndex('createdAt', 'createdAt', { unique: false })
          store.createIndex('updatedAt', 'updatedAt', { unique: false })
        }
      }
      request.onsuccess = () => {
        console.log('Vocabify IndexDB initialazed successfully.')
        resolve(request.result)
      }
      request.onerror = (event) => {
        console.error('Vocabify IndexDB initialazed failed. with blow error information: \n', (event.target as IDBRequest).error)
        reject((event.target as IDBRequest).error)
      }
    })
  }
  async addOrUpdateData(data: addOrUpdateDataRecord): Promise<{ title: string, detail: string }> {
    const db = await this.openDatabase()
    return new Promise(async (resolve, reject) => {
      const transaction = db.transaction('dataStore', 'readwrite')
      const store = transaction.objectStore('dataStore')
      const index = store.index('wordOrPhrase') // 使用索引
      const _request = index.get(data.wordOrPhrase.trim().toLocaleLowerCase())
      const ResolveResult = {
        add: {
          title: 'Done 🥳🎉🎉',
          detail: 'Data added successfully!',
        },
        update: {
          title: 'Updated 🔄✨✨',
          detail: 'Already existed, Update to new data!',
        },
      }
      _request.onsuccess = (event) => {
        const existed = (event.target as IDBRequest).result
        if (existed) {
          data.id = existed.id
        }

        const request = store.put({
          ...data,
          wordOrPhrase: data.wordOrPhrase.trim().toLocaleLowerCase(), //对插入的单词或短语作预处理
          createdAt: new Date().toISOString(), // 插入当前时间
          updatedAt: new Date().toISOString(), // 同时添加更新时间
        }) // 增加或更新数据

        request.onsuccess = () => {
          resolve(existed ? ResolveResult.update : ResolveResult.add)
        }
        request.onerror = (event) => {
          console.error('Vocabify Data added failed!, with below error information: \n', (event.target as IDBRequest).error)
          reject((event.target as IDBRequest).error)
        }
      }
      _request.onerror = (event) => {
        reject((event.target as IDBRequest).error)
      }
    })
  }

  async deleteData(wordOrPhrase: string): Promise<undefined | string> {
    const db = await this.openDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('dataStore', 'readwrite')
      const store = transaction.objectStore('dataStore')
      const index = store.index('wordOrPhrase') // 使用索引
      const _request = index.get(wordOrPhrase.trim().toLocaleLowerCase())

      _request.onsuccess = (event) => {
        const existed = (event.target as IDBRequest).result
        if (existed) {
          const deleteRequest = store.delete(existed.id)

          deleteRequest.onsuccess = () => {
            console.log(`Record with wordOrPhrase "${wordOrPhrase}" deleted successfully`)
            resolve(undefined)
          }

          deleteRequest.onerror = (event) => {
            console.error('Delete error:', (event.target as IDBRequest).error)
            reject('Delete error')
          }
        } else {
          reject('Record not found')
        }
      }

      _request.onerror = (event) => {
        reject((event.target as IDBRequest).error)
      }
    })
  }

  async getDataByWord(word: string): Promise<any> {
    const db = await this.openDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('dataStore', 'readonly')
      const store = transaction.objectStore('dataStore')
      const index = store.index('wordOrPhrase') // 使用索引
      const request = index.get(word)
      request.onsuccess = (event) => resolve((event.target as IDBRequest).result)
      request.onerror = (event) => reject((event.target as IDBRequest).error)
    })
  }
  async fuzzySearchByKeyword(keywords: string): Promise<{ records: any[]; total: number }> {
    console.log('keywords', keywords)
    const db = await this.openDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('dataStore', 'readonly')
      const store = transaction.objectStore('dataStore')
      const index = store.index('wordOrPhrase') // 使用索引
      const request = index.getAll()

      request.onsuccess = (event) => {
        const allData = (event.target as IDBRequest).result
        const filteredData = allData.filter(
          (item: any) => item.wordOrPhrase.includes(keywords) // 根据字段模糊匹配
        )
        resolve(filteredData)
      }
      request.onerror = (event) => reject((event.target as IDBRequest).error)
    })
  }

  async findByPage(pageNum: number, pageSize: number): Promise<{ records: any[]; total: number }> {
    const db = await this.openDatabase()

    return new Promise(async (resolve, reject) => {
      const totalCount = await this.getTotalCount() // 获取总条目数

      const transaction = db.transaction('dataStore', 'readonly')
      const store = transaction.objectStore('dataStore')

      // 获取 'updateAtIndex' 索引
      const index = store.index('updatedAt')

      const results: {
        records: any[]
        total: number
      } = {
        records: [],
        total: Math.ceil((totalCount as number) / pageSize),
      }

      // 获取游标，按 'updateAt' 降序排列
      const cursorRequest = index.openCursor(null, 'prev') // 'prev' 为降序

      let currentIndex = 0

      cursorRequest.onsuccess = function (event) {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          // 检查是否是需要的页
          if (currentIndex >= (pageNum - 1) * pageSize && currentIndex < pageNum * pageSize) {
            results.records.push(cursor.value) // 收集所需的记录
          }
          currentIndex++

          // 如果结果集已达到所需的页大小，则停止继续查询
          if (results.records.length < pageSize) {
            cursor.continue() // 继续下一个游标
          } else {
            resolve(results) // 返回结果
          }
        } else {
          // 没有更多的数据
          resolve(results) // 返回结果
        }
      }

      cursorRequest.onerror = function (event) {
        reject((event.target as IDBRequest).error)
      }
    })
  }

  // 获取所有条目的总数
  async getTotalCount(): Promise<number> {
    const db = await this.openDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('dataStore', 'readonly')
      const store = transaction.objectStore('dataStore')

      const countRequest = store.count()

      countRequest.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result) // 返回总条目数
      }

      countRequest.onerror = (event) => {
        reject((event.target as IDBRequest).error)
      }
    })
  }

  async getAllData(): Promise<any[]> {
    const db = await this.openDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('dataStore', 'readonly')
      const store = transaction.objectStore('dataStore')

      const request = store.getAll() // 获取所有数据

      request.onsuccess = () => resolve(request.result)
      request.onerror = (event) => reject((event.target as IDBRequest).error)
    })
  }
}

// 数据查询
// const getDataById = async (id) => {
//     const db = await openDatabase();

//     return new Promise((resolve, reject) => {
//       const transaction = db.transaction("dataStore", "readonly");
//       const store = transaction.objectStore("dataStore");

//       const request = store.get(id); // 按主键查询

//       request.onsuccess = () => resolve(request.result);
//       request.onerror = (event) => reject(event.target.error);
//     });
//   };

//   // 示例：查询 id 为 1 的数据
//   getDataById(1).then(console.log).catch(console.error);

//   // 示例：查询单词 "example"
//   getDataByWord("example").then(console.log).catch(console.error);

// 修改数据

// const updateData = async (id, updatedFields) => {
//     const existingData = await getDataById(id);
//     if (!existingData) throw new Error(`Data with id ${id} not found`);

//     const updatedData = { ...existingData, ...updatedFields }; // 合并新旧数据
//     return addOrUpdateData(updatedData); // 复用 `addOrUpdateData` 函数
//   };

//   // 示例：更新 id 为 1 的数据
//   updateData(1, { meaning: "示例 - 已更新" })
//     .then(console.log)
//     .catch(console.error);

// 查询所有数据

// const getAllData = async () => {
//     const db = await openDatabase();

//     return new Promise((resolve, reject) => {
//       const transaction = db.transaction("dataStore", "readonly");
//       const store = transaction.objectStore("dataStore");

//       const request = store.getAll(); // 获取所有数据

//       request.onsuccess = () => resolve(request.result);
//       request.onerror = (event) => reject(event.target.error);
//     });
//   };

//   // 示例：查询所有数据
//   getAllData().then(console.log).catch(console.error);
