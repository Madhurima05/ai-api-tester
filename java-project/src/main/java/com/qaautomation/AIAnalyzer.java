package com.qaautomation;

import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.json.JSONArray;
import org.json.JSONObject;
import io.github.cdimascio.dotenv.Dotenv;

public class AIAnalyzer {

    public static String analyzeResults(String testResults) {
        Dotenv dotenv = Dotenv.configure()
                .directory(System.getProperty("user.dir"))
                .ignoreIfMissing()
                .load();

        String apiKey = dotenv.get("GROQ_API_KEY");

        if (apiKey == null || apiKey.isEmpty()) {
            return "No GROQ_API_KEY found in .env file";
        }

        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            HttpPost request = new HttpPost("https://api.groq.com/openai/v1/chat/completions");
            request.setHeader("Authorization", "Bearer " + apiKey);
            request.setHeader("Content-Type", "application/json");

            JSONObject body = new JSONObject();
            body.put("model", "llama-3.3-70b-versatile");

            JSONArray messages = new JSONArray();

            JSONObject systemMsg = new JSONObject();
            systemMsg.put("role", "system");
            systemMsg.put("content", "You are an expert QA engineer. Analyze test results and provide a brief summary and recommendations.");

            JSONObject userMsg = new JSONObject();
            userMsg.put("role", "user");
            userMsg.put("content", "Analyze these API test results and give a short summary:\n" + testResults);

            messages.put(systemMsg);
            messages.put(userMsg);
            body.put("messages", messages);
            body.put("max_tokens", 500);

            request.setEntity(new StringEntity(body.toString()));

            return httpClient.execute(request, response -> {
                String responseBody = EntityUtils.toString(response.getEntity());
                JSONObject json = new JSONObject(responseBody);
                return json.getJSONArray("choices")
                        .getJSONObject(0)
                        .getJSONObject("message")
                        .getString("content");
            });

        } catch (Exception e) {
            return "AI Analysis error: " + e.getMessage();
        }
    }
}