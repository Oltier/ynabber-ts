import { Collection, Document, Filter, MongoClient } from "mongodb";
import { Projection } from "../../utils/mongo-types";

export default class Repository<TSchema extends Document = Document> {
  db: string;
  collection: string;
  client: MongoClient;

  constructor(db: string, collection: string, client: MongoClient) {
    this.db = db;
    this.collection = collection;
    this.client = client;
  }

  private async getCollection(): Promise<Collection<TSchema>> {
    return this.client.db(this.db).collection<TSchema>(this.collection);
  }

  async findOne(
    filter: Filter<TSchema>,
    projection?: Projection<Partial<TSchema>>,
  ) {
    const collection = await this.getCollection();
    return collection.findOne(filter, { projection });
  }
}
