import pytest
import respx
from httpx import Response
from backend.services.platforms.bilibili import BilibiliPlatform

@pytest.fixture
def bilibili_platform():
    return BilibiliPlatform()

@pytest.mark.asyncio
async def test_bilibili_analyze_multi_page(bilibili_platform):
    url = "https://www.bilibili.com/video/BV1xx411c7X7"
    
    # Mock data for a multi-page video
    mock_data = {
        "code": 0,
        "data": {
            "bvid": "BV1xx411c7X7",
            "title": "Multi-Part Video",
            "pic": "http://cover.jpg",
            "owner": {"name": "Uploader"},
            "pages": [
                {"page": 1, "part": "Part 1", "duration": 100},
                {"page": 2, "part": "Part 2", "duration": 200}
            ]
        }
    }

    with respx.mock(base_url="https://api.bilibili.com") as respx_mock:
        respx_mock.get("/x/web-interface/view").mock(return_value=Response(200, json=mock_data))
        
        result = await bilibili_platform.analyze(url)
        
        assert result.type == "playlist"
        assert result.title == "Multi-Part Video (分P共2P)"
        assert result.count == 2
        assert len(result.items) == 2
        assert result.items[0].title == "P1 - Part 1"
        assert result.items[1].title == "P2 - Part 2"
        assert "p=1" in result.items[0].url
        assert "p=2" in result.items[1].url

@pytest.mark.asyncio
async def test_bilibili_analyze_ugc_season(bilibili_platform):
    url = "https://www.bilibili.com/video/BV1xx411c7X7"
    
    # Mock data for UGC Season (Collection)
    mock_data = {
        "code": 0,
        "data": {
            "bvid": "BV1xx411c7X7",
            "title": "Season Video",
            "pic": "http://cover.jpg",
            "owner": {"name": "Uploader"},
            "ugc_season": {
                "title": "My Season",
                "sections": [
                    {
                        "episodes": [
                            {"bvid": "BV1", "title": "Ep1", "arc": {"duration": 100}},
                            {"bvid": "BV2", "title": "Ep2", "arc": {"duration": 200}}
                        ]
                    }
                ]
            }
        }
    }

    with respx.mock(base_url="https://api.bilibili.com") as respx_mock:
        respx_mock.get("/x/web-interface/view").mock(return_value=Response(200, json=mock_data))
        
        result = await bilibili_platform.analyze(url)
        
        assert result.type == "playlist"
        assert "My Season" in result.title
        assert result.count == 2
        assert result.items[0].url == "https://www.bilibili.com/video/BV1"
        assert result.items[0].title == "Ep1"

@pytest.mark.asyncio
async def test_bilibili_malformed_response(bilibili_platform):
    url = "https://www.bilibili.com/video/BV1xx411c7X7"
    
    # CASE 1: Missing 'pages' and 'ugc_season' (Should return None or handle gracefully)
    mock_data_empty = {
        "code": 0,
        "data": {
            "bvid": "BV1xx411c7X7",
            "title": "Weird Video",
            "owner": {"name": "Uploader"},
            # Missing pages
            # Missing ugc_season
        }
    }

    with respx.mock(base_url="https://api.bilibili.com") as respx_mock:
        respx_mock.get("/x/web-interface/view").mock(return_value=Response(200, json=mock_data_empty))
        
        # This currently relies on the code checking keys safely. 
        # Let's see if it raises KeyError or returns None.
        result = await bilibili_platform.analyze(url)
        assert result is None # Expect fallback to yt-dlp if specific logic fails

@pytest.mark.asyncio
async def test_bilibili_api_error(bilibili_platform):
    url = "https://www.bilibili.com/video/BV1xx411c7X7"
    
    mock_data_error = {
        "code": -404,
        "message": "Video not found"
    }
    
    with respx.mock(base_url="https://api.bilibili.com") as respx_mock:
        respx_mock.get("/x/web-interface/view").mock(return_value=Response(200, json=mock_data_error))
        
        result = await bilibili_platform.analyze(url)
        assert result is None

@pytest.mark.asyncio
async def test_bilibili_missing_critical_fields(bilibili_platform, caplog):
    url = "https://www.bilibili.com/video/BV1xx411c7X7?p=1"
    
    # CASE 3: Has pages (so it tries to construct playlist) but MISSING 'owner'
    mock_data_broken = {
        "code": 0,
        "data": {
            "bvid": "BV1xx411c7X7",
            "title": "Broken Video",
            "pic": "http://cover.jpg",
            # Missing owner
            "pages": [
                 {"page": 1, "part": "P1", "duration": 10},
                 {"page": 2, "part": "P2", "duration": 20}
            ]
        }
    }

    # Direct call to _parse_api_response should raise KeyError because we bypass the broad try/except
    with pytest.raises(KeyError) as excinfo:
        # Note: We don't need respx here because we are not making HTTP calls, 
        # just testing the parsing logic with the dictionary directly.
        bilibili_platform._parse_api_response(url, mock_data_broken)
    
    assert "'owner'" in str(excinfo.value)
