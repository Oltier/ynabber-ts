import { Collection, MongoClient, ObjectId } from "mongodb";
import Repository from "./repository"; // Adjust the import path as needed

// Create mock types
type MockCollection = {
  findOne: jest.Mock;
};

type MockDb = {
  collection: jest.Mock<MockCollection>;
};

type MockMongoClient = {
  db: jest.Mock<MockDb>;
};

// Mock MongoClient
jest.mock("mongodb", () => ({
  MongoClient: jest.fn().mockImplementation(() => ({
    db: jest.fn().mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn(),
      }),
    }),
  })),
  ObjectId: jest.fn().mockImplementation((id) => ({ _id: id })),
}));

describe("Repository", () => {
  let repository: Repository;
  let mockClient: MockMongoClient;

  beforeEach(() => {
    mockClient = new (MongoClient as jest.MockedClass<typeof MongoClient>)(
      "mongodb://localhost:27017",
    ) as unknown as MockMongoClient;
    repository = new Repository(
      "testDb",
      "testCollection",
      mockClient as unknown as MongoClient,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with correct properties", () => {
      expect(repository.db).toBe("testDb");
      expect(repository.collection).toBe("testCollection");
      expect(repository.client).toBe(mockClient);
    });
  });

  describe("getCollection", () => {
    it("should return a collection", async () => {
      const mockCollection = { findOne: jest.fn() } as unknown as Collection;
      // @ts-ignore
      mockClient.db().collection.mockReturnValue(mockCollection);

      const result = await (repository as any).getCollection();

      expect(mockClient.db).toHaveBeenCalledWith("testDb");
      expect(mockClient.db().collection).toHaveBeenCalledWith("testCollection");
      expect(result).toBe(mockCollection);
    });
  });

  describe("findOne", () => {
    it("should call findOne on the collection with correct parameters", async () => {
      const mockFilter = { _id: new ObjectId("123456789012") };
      const mockProjection = { name: 1, age: 1 };
      const mockResult = {
        _id: new ObjectId("123456789012"),
        name: "Test",
        age: 30,
      };

      const mockCollection = {
        findOne: jest.fn().mockResolvedValue(mockResult),
      };
      mockClient.db().collection.mockReturnValue(mockCollection);

      const result = await repository.findOne(mockFilter, mockProjection);

      expect(mockClient.db).toHaveBeenCalledWith("testDb");
      expect(mockClient.db().collection).toHaveBeenCalledWith("testCollection");
      expect(mockCollection.findOne).toHaveBeenCalledWith(mockFilter, {
        projection: mockProjection,
      });
      expect(result).toEqual(mockResult);
    });

    it("should call findOne without projection if not provided", async () => {
      const mockFilter = { _id: new ObjectId("123456789012") };
      const mockResult = {
        _id: new ObjectId("123456789012"),
        name: "Test",
        age: 30,
      };

      const mockCollection = {
        findOne: jest.fn().mockResolvedValue(mockResult),
      };
      mockClient.db().collection.mockReturnValue(mockCollection);

      const result = await repository.findOne(mockFilter);

      expect(mockCollection.findOne).toHaveBeenCalledWith(mockFilter, {
        projection: undefined,
      });
      expect(result).toEqual(mockResult);
    });

    it("should handle errors from findOne", async () => {
      const mockFilter = { _id: new ObjectId("123456789012") };
      const mockError = new Error("Database error");

      const mockCollection = {
        findOne: jest.fn().mockRejectedValue(mockError),
      };
      mockClient.db().collection.mockReturnValue(mockCollection);

      await expect(repository.findOne(mockFilter)).rejects.toThrow(
        "Database error",
      );
    });
  });
});
