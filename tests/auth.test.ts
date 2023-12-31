import request from "supertest";
import app from "../server.js";
import mongoose from "mongoose";
import User from "../models/user_model.js";
import Post from "../models/post_model.js";

const user = {
  username: "test", //add as reserved usernames in code
  email: "test@test.com", //add as reserved email in code
  password: "Password123",
};
let tokens: { accessToken: string; refreshToken: string; userId: string };

beforeAll(async () => await User.deleteOne({ username: "test" }));
afterAll(async () => await mongoose.connection.close());

describe("Authentication Tests", () => {
  test("request posting with no token", async () => {
    const response = await request(app).post("/post").send({
      text: "this is my test post",
    });
    expect(response.statusCode).toEqual(401);
  });

  test("register", async () => {
    const response = await request(app).post("/auth/register").send(user);
    expect(response.statusCode).toEqual(200);
  });

  test("register with taken username", async () => {
    const response = await request(app).post("/auth/register").send(user);
    expect(response.statusCode).toEqual(400);
    expect(response.body.message).toEqual("username already taken");
  });

  test("register with used email", async () => {
    const response = await request(app).post("/auth/register").send({
      username: "other",
      email: user.email,
      password: user.password,
    });
    expect(response.statusCode).toEqual(400);
    expect(response.body.message).toEqual("email already used");
  });

  test("login with username and password", async () => {
    const response = await request(app).post("/auth/login").send({
      identifier: user.username,
      password: user.password,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body.accessToken).not.toBeUndefined();
    expect(response.body.refreshToken).not.toBeUndefined();
    expect(response.body.accessToken).not.toEqual(response.body.refreshToken);
    expect(response.body.userId).not.toBeUndefined();
    await request(app)
      .get("/auth/logout")
      .set("Authorization", "jwt " + response.body.refreshToken)
      .send();
  });

  test("login with email and password", async () => {
    const response = await request(app).post("/auth/login").send({
      identifier: user.email,
      password: user.password,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body.accessToken).not.toBeUndefined();
    expect(response.body.refreshToken).not.toBeUndefined();
    expect(response.body.accessToken).not.toEqual(response.body.refreshToken);
    expect(response.body.userId).not.toBeUndefined();
    tokens = response.body;
  });

  test("login with unregistered identifier", async () => {
    const response = await request(app).post("/auth/login").send({
      identifier: "unregistered", //add as reserved usernames in code
      password: user.password,
    });
    expect(response.statusCode).toEqual(400);
    expect(response.body.message).toEqual("incorrect identifier or password");
  });

  test("login with correct email and wrong password", async () => {
    const response = await request(app).post("/auth/login").send({
      identifier: user.email,
      password: "wrongPassword",
    });
    expect(response.statusCode).toEqual(400);
    expect(response.body.message).toEqual("incorrect identifier or password");
  });

  test("login with correct username and wrong password", async () => {
    const response = await request(app).post("/auth/login").send({
      identifier: user.username,
      password: "wrongPassword",
    });
    expect(response.statusCode).toEqual(400);
    expect(response.body.message).toEqual("incorrect identifier or password");
  });

  /// add tests for change password email and username ///
  test("update password with wrong old password", async () => {
    const response = await request(app)
      .post("/auth/change/password")
      .set("Authorization", "jwt " + tokens.accessToken)
      .send({
        oldPassword: user.password + "1",
        newPassword: user.password + "1",
      });
    expect(response.statusCode).toEqual(400);
    expect(response.body.message).toEqual("old password is incorrect");
  });

  test("update password", async () => {
    const response = await request(app)
      .post("/auth/change/password")
      .set("Authorization", "jwt " + tokens.accessToken)
      .send({
        oldPassword: user.password,
        newPassword: user.password + "1",
      });
    expect(response.statusCode).toEqual(200);
    await request(app)
      .post("/auth/change/password")
      .set("Authorization", "jwt " + tokens.accessToken)
      .send({
        oldPassword: user.password + "1",
        newPassword: user.password,
      });
  });

  test("update email", async () => {
    const response = await request(app)
      .post("/auth/change/email")
      .set("Authorization", "jwt " + tokens.accessToken)
      .send({ email: "another@test.com" }); //save to reserved email addresses
    expect(response.statusCode).toEqual(200);
    await request(app)
      .post("/auth/change/email")
      .set("Authorization", "jwt " + tokens.accessToken)
      .send({ email: user.email });
  });

  test("update username", async () => {
    const response = await request(app)
      .post("/auth/change/username")
      .set("Authorization", "jwt " + tokens.accessToken)
      .send({ username: "testUser" }); // save to reserved usernames
    expect(response.statusCode).toEqual(200);
    await request(app)
      .post("/auth/change/username")
      .set("Authorization", "jwt " + tokens.accessToken)
      .send({ username: user.username });
  });

  test("request posting with valid token", async () => {
    const response = await request(app)
      .post("/post")
      .set("Authorization", "jwt " + tokens.accessToken)
      .send({ text: "this is my test post" });
    expect(response.statusCode).toEqual(200);
    await Post.deleteOne({ owner: tokens.userId });
  });

  test("request posting with invalid token", async () => {
    const response = await request(app)
      .post("/post")
      .set("Authorization", "jwt " + tokens.refreshToken)
      .send({
        message: "this is my test post",
        sender: user.username,
      });
    expect(response.statusCode).toEqual(403);
  });

  // jest.setTimeout(10000);

  // test("request posting with expired token", async () => {
  //   await new Promise((r) => setTimeout(r, 3000));
  //   const response = await request(app)
  //     .post("/post")
  //     .set("Authorization", "jwt " + accessToken)
  //     .send({
  //       message: "this is my test post",
  //       sender: user.username,
  //     });
  //   expect(response.body.message).toEqual("jwt expired");
  // });

  test("refresh token with valid unused token", async () => {
    await new Promise((r) => setTimeout(r, 1000));
    const response = await request(app)
      .get("/auth/refresh")
      .set("Authorization", "jwt " + tokens.refreshToken);
    expect(response.statusCode).toEqual(200);
    expect(response.body.accessToken).not.toEqual(tokens.accessToken);
    expect(response.body.refreshToken).not.toEqual(tokens.refreshToken);
    expect(response.body.userId).toEqual(tokens.userId);
    tokens = response.body;
  });

  test("logout with false token", async () => {
    const response = await request(app)
      .get("/auth/logout")
      .set("Authorization", "jwt " + tokens.accessToken);
    expect(response.statusCode).toEqual(403);
  });

  test("logout with correct token", async () => {
    const response = await request(app)
      .get("/auth/logout")
      .set("Authorization", "jwt " + tokens.refreshToken);
    expect(response.statusCode).toEqual(200);
  });
});
