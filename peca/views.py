from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .models import Vote
import json


def index(request):
    return render(request, 'index.html')


@csrf_exempt
@require_POST
def vote(request):
    try:
        data = json.loads(request.body)
        movie = data.get('movie')
        if movie not in ['Moana', 'Encanto', 'Enrolados']:
            return JsonResponse({'error': 'Invalid movie choice'}, status=400)
        print(movie)
        Vote.objects.create(movie=movie)
        return JsonResponse({'message': 'Vote recorded successfully'})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def get_votes(request):
    votes = Vote.objects.all()
    vote_counts = {'Moana': 0, 'Encanto': 0, 'Enrolados': 0}
    for vote in votes:
        if vote.movie in vote_counts:
            vote_counts[vote.movie] += 1
    return JsonResponse(vote_counts)

