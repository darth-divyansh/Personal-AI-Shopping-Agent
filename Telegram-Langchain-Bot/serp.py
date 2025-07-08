from serpapi import GoogleSearch
import json

# Set your SerpAPI key
SERPAPI_KEY = "8afa65e200c1228a389068abff76a0b7ec70e2a95f82816780f1873e17f4b02e"

def search_flipkart_products(query, num_results=5):
    search_query = f"{query} site:flipkart.com"
    
    params = {
        "engine": "google",
        "q": search_query,
        "api_key": SERPAPI_KEY,
        "num": num_results
    }

    print(f"🔍 Searching for: {search_query}")

    search = GoogleSearch(params)
    results = search.get_dict()
    
    # DEBUG: Print full result for inspection
    # print(json.dumps(results, indent=2))

    shopping_results = results.get("shopping_results", [])
    
    if shopping_results:
        print("\n✅ Found shopping results:\n")
        for item in shopping_results:
            title = item.get("title", "No title")
            price = item.get("price", "N/A")
            link = item.get("link", "No link")
            print(f"📱 {title}")
            print(f"💰 {price}")
            print(f"🔗 {link}\n")
        return

    # Fallback: Try organic search results
    organic_results = results.get("organic_results", [])
    if organic_results:
        print("\n⚠️ No shopping results found. Showing organic Flipkart links:\n")
        for item in organic_results:
            title = item.get("title", "No title")
            link = item.get("link", "No link")
            snippet = item.get("snippet", "No description")
            print(f"📱 {title}")
            print(f"📝 {snippet}")
            print(f"🔗 {link}\n")
        return

    print("❌ No products or links found.")

# Example usage
if __name__ == "__main__":
    search_flipkart_products("Lenovo IdeaPad")
