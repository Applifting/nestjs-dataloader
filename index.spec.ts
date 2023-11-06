import { sortDataLoaderResultsByKey } from "./index";

describe("index.spec.ts", () => {
  describe("sortDataLoaderResultsByKey", () => {
    it("should sort the results of the data loader by the key", () => {
      const keys = ["1", "2", "3"];
      const items = [{ id: "2" }, { id: "1" }, { id: "3" }];
      const key = "id";
      const result = sortDataLoaderResultsByKey(keys, items, key);
      expect(result).toEqual([{ id: "1" }, { id: "2" }, { id: "3" }]);
    });
  });
});
