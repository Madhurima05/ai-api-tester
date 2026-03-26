package com.qaautomation;

import io.restassured.RestAssured;
import io.restassured.response.Response;
import org.junit.jupiter.api.*;
import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;
import java.util.ArrayList;
import java.util.List;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class AppTest {

    static List<String> results = new ArrayList<>();

    @BeforeAll
    public static void setup() {
        RestAssured.baseURI = "https://jsonplaceholder.typicode.com";
        System.out.println("Starting AI-Powered API Tests...\n");
    }

    @Test
    @Order(1)
    public void testGetAllPosts() {
        System.out.println("TEST 1: GET /posts");
        given()
            .when()
            .get("/posts")
            .then()
            .statusCode(200)
            .body("size()", greaterThan(0));
        results.add("PASS: GET /posts returns 200 and list");
        System.out.println("PASS: GET /posts returns 200 and list\n");
    }

    @Test
    @Order(2)
    public void testGetSinglePost() {
        System.out.println("TEST 2: GET /posts/1");
        Response response = given()
            .when()
            .get("/posts/1")
            .then()
            .statusCode(200)
            .body("id", equalTo(1))
            .body("title", notNullValue())
            .extract().response();
        results.add("PASS: GET /posts/1 returns valid post");
        System.out.println("PASS: Post title: " + response.jsonPath().getString("title") + "\n");
    }

    @Test
    @Order(3)
    public void testCreatePost() {
        System.out.println("TEST 3: POST /posts");
        given()
            .header("Content-Type", "application/json")
            .body("{\"title\": \"AI QA Test\", \"body\": \"Created by Java AI Tester\", \"userId\": 1}")
            .when()
            .post("/posts")
            .then()
            .statusCode(201)
            .body("id", notNullValue());
        results.add("PASS: POST /posts creates new post with 201");
        System.out.println("PASS: POST /posts creates new post\n");
    }

    @Test
    @Order(4)
    public void testGetAllUsers() {
        System.out.println("TEST 4: GET /users");
        given()
            .when()
            .get("/users")
            .then()
            .statusCode(200)
            .body("size()", equalTo(10));
        results.add("PASS: GET /users returns 10 users");
        System.out.println("PASS: GET /users returns 10 users\n");
    }

    @Test
    @Order(5)
    public void testGetInvalidPost() {
        System.out.println("TEST 5: GET /posts/999");
        given()
            .when()
            .get("/posts/999")
            .then()
            .statusCode(404);
        results.add("PASS: GET /posts/999 returns 404");
        System.out.println("PASS: GET /posts/999 returns 404\n");
    }

    @AfterAll
    public static void analyzeWithAI() {
        System.out.println("========================");
        System.out.println("Sending results to Groq AI...\n");

        String testSummary = String.join("\n", results);
        String analysis = AIAnalyzer.analyzeResults(testSummary);

        System.out.println("AI Analysis:");
        System.out.println("============");
        System.out.println(analysis);
        System.out.println("========================");
    }
}