def test_health_check(client):
    """Test the health check endpoint returns 200 OK."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "online"
    assert "service" in response.json()
