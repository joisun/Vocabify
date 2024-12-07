export default class VocabifyIndexDB {
  db: any;
  constructor() {
    console.log("initialaze vocabify indexDB");
    this.db = this.openDatabase();
  }
  openDatabase() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("MyDatabase", 1);
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = event.target?.result;

        // 创建对象存储，设置 "id" 为主键
        if (!db.objectStoreNames.contains("dataStore")) {
          const store = db.createObjectStore("dataStore", { keyPath: "id" });
          // 可创建额外索引
          store.createIndex("wordIndex", "word", { unique: false });
        }
      };
      request.onsuccess = () => {
        console.log("Vocabify IndexDB initialazed successfully.");
        resolve(request.result);
      };
      request.onerror = (event) => {
        console.error(
          "Vocabify IndexDB initialazed failed. with blow error information: \n",
          event.target?.error
        );
        reject(event.target?.error);
      };
    });
  }
  async addData(data: any) {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("dataStore", "readwrite");
      const store = transaction.objectStore("dataStore");
      const request = store.put(data); // 增加或更新数据

      request.onsuccess = () => {
        console.log("Vocabify Data added successfully!");
        resolve("Data added successfully!");
      };
      request.onerror = (event) => {
        console.error(
          "Vocabify Data added failed!, with below error information: \n",
          event.target.error
        );
        reject(event.target.error);
      };
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

// 主键查询

//   const getDataByWord = async (word) => {
//     const db = await openDatabase();

//     return new Promise((resolve, reject) => {
//       const transaction = db.transaction("dataStore", "readonly");
//       const store = transaction.objectStore("dataStore");

//       const index = store.index("wordIndex"); // 使用索引
//       const request = index.get(word);

//       request.onsuccess = () => resolve(request.result);
//       request.onerror = (event) => reject(event.target.error);
//     });
//   };

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
