type AddDataRecord = {
  wordOrParase: string;
  meaning: string;
};
export default class VocabifyIndexDB {
  private dbname = "VocabifyIndexDB";
  db: any;
  constructor() {
    console.log("initialaze vocabify indexDB");
    this.db = this.openDatabase();
  }

  openDatabase() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbname, 1);
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBRequest).result;

        // 创建对象存储，设置 "id" 为主键
        if (!db.objectStoreNames.contains("dataStore")) {
          const store = db.createObjectStore("dataStore", {
            keyPath: "id",
            autoIncrement: true,
          });
          // 可创建额外索引: 目的用于查询，可以对单词进行查询，而不仅仅是主键
          store.createIndex("wordOrParase", "wordOrParase", { unique: false });
          // 为时间戳创建索引: 目的用于日后有对时间范围过滤的需求
          store.createIndex("createdAt", "createdAt", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };
      request.onsuccess = () => {
        console.log("Vocabify IndexDB initialazed successfully.");
        resolve(request.result);
      };
      request.onerror = (event) => {
        console.error(
          "Vocabify IndexDB initialazed failed. with blow error information: \n",
          (event.target as IDBRequest).error
        );
        reject((event.target as IDBRequest).error);
      };
    });
  }
  async addData(data: AddDataRecord) {
    const db = await this.openDatabase();
    return new Promise(async (resolve, reject) => {
      const transaction = db.transaction("dataStore", "readwrite");
      const store = transaction.objectStore("dataStore");
      const index = store.index("wordOrParase"); // 使用索引
      const _request = index.get(data.wordOrParase.trim().toLocaleLowerCase());
      _request.onsuccess = (event) => {
        const existed = (event.target as IDBRequest).result;
        if (existed) {
          resolve("Already existed,there is no need to save again.");
          return;
        }
        const request = store.put({
          ...data,
          wordOrParase: data.wordOrParase.trim().toLocaleLowerCase(), //对插入的单词或短语作预处理
          createdAt: new Date().toISOString(), // 插入当前时间
          updatedAt: new Date().toISOString(), // 同时添加更新时间
        }); // 增加或更新数据

        request.onsuccess = () => {
          resolve("Data added successfully!");
        };
        request.onerror = (event) => {
          console.error(
            "Vocabify Data added failed!, with below error information: \n",
            (event.target as IDBRequest).error
          );
          reject((event.target as IDBRequest).error);
        };
      };
      _request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };
    });
  }

  async getDataByWord(word: string) {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("dataStore", "readonly");
      const store = transaction.objectStore("dataStore");
      const index = store.index("wordOrParase"); // 使用索引
      const request = index.get(word);
      request.onsuccess = (event) =>
        resolve((event.target as IDBRequest).result);
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  }
}

// const addData = async (data) => {
//     const db = await openDatabase();

//     return new Promise((resolve, reject) => {
//       const transaction = db.transaction("dataStore", "readwrite");
//       const store = transaction.objectStore("dataStore");

//       const request = store.put(data); // 增加或更新数据

//       request.onsuccess = () => resolve("Data added successfully!");
//       request.onerror = (event) => reject(event.target.error);
//     });
//   };

//   // 示例：添加数据
//   addData({
//     id: 1, // 主键
//     word: "example",
//     meaning: "示例",
//     timestamp: Date.now()
//   }).then(console.log).catch(console.error);

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
//     return addData(updatedData); // 复用 `addData` 函数
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
